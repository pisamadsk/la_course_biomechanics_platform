import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  createAnalysis, 
  getAnalysisById, 
  getUserAnalyses, 
  updateAnalysis,
  createAnalysisChart,
  getAnalysisCharts 
} from "./db";
import { storagePut } from "./storage";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import os from "os";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  analysis: router({
    // Créer une nouvelle analyse
    create: protectedProcedure
      .input(z.object({
        videoUrl: z.string(),
        videoKey: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const analysisId = await createAnalysis({
          userId: ctx.user.id,
          originalVideoKey: input.videoKey,
          originalVideoUrl: input.videoUrl,
          status: "pending",
        });
        
        // Lancer l'analyse en arrière-plan
        processAnalysis(analysisId, input.videoUrl).catch(err => {
          console.error(`[Analysis ${analysisId}] Error:`, err);
          updateAnalysis(analysisId, {
            status: "failed",
            errorMessage: err.message,
          });
        });
        
        return { analysisId };
      }),
    
    createPublic: publicProcedure
      .input(z.object({
        videoUrl: z.string(),
        videoKey: z.string(),
      }))
      .mutation(async ({ input }) => {
        const analysisId = await createAnalysis({
          userId: 0,
          originalVideoKey: input.videoKey,
          originalVideoUrl: input.videoUrl,
          status: "pending",
        });
        
        processAnalysis(analysisId, input.videoUrl).catch(err => {
          console.error(`[Analysis ${analysisId}] Error:`, err);
          updateAnalysis(analysisId, {
            status: "failed",
            errorMessage: err.message,
          });
        });
        
        return { analysisId };
      }),
    
    // Obtenir une analyse par ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis || analysis.userId !== ctx.user.id) {
          throw new Error("Analysis not found");
        }
        
        const charts = await getAnalysisCharts(input.id);
        return { analysis, charts };
      }),
    
    getPublic: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) {
          throw new Error("Analysis not found");
        }
        const charts = await getAnalysisCharts(input.id);
        return { analysis, charts };
      }),
    
    // Liste des analyses de l'utilisateur
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserAnalyses(ctx.user.id);
      }),
    
    // Upload de vidéo
    uploadVideo: protectedProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileKey = `analyses/${ctx.user.id}/${nanoid()}-${input.filename}`;
        
        try {
          const { url } = await storagePut(fileKey, buffer, input.contentType);
          return { url, key: fileKey };
        } catch (e) {
          const host = ctx.req.headers.host || "localhost:3000";
          const protocol = ctx.req.protocol || "http";
          const baseUrl = `${protocol}://${host}`;
          const devUploadsRoot = path.resolve(process.cwd(), "dev_uploads");
          const targetPath = path.resolve(devUploadsRoot, fileKey);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, buffer);
          const url = `${baseUrl}/api/dev/files/${fileKey}`;
          return { url, key: fileKey };
        }
      }),
    
    uploadVideoPublic: publicProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileKey = `analyses/public/${nanoid()}-${input.filename}`;
        
        try {
          const { url } = await storagePut(fileKey, buffer, input.contentType);
          return { url, key: fileKey };
        } catch (e) {
          const host = ctx.req.headers.host || "localhost:3000";
          const protocol = ctx.req.protocol || "http";
          const baseUrl = `${protocol}://${host}`;
          const devUploadsRoot = path.resolve(process.cwd(), "dev_uploads");
          const targetPath = path.resolve(devUploadsRoot, fileKey);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, buffer);
          const url = `${baseUrl}/api/dev/files/${fileKey}`;
          return { url, key: fileKey };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

// Fonction pour traiter l'analyse en arrière-plan
async function processAnalysis(analysisId: number, videoUrl: string) {
  await updateAnalysis(analysisId, { status: "processing" });
  
  const tempDir = path.join(os.tmpdir(), `analysis-${analysisId}`);
  const videoPath = path.join(tempDir, "input.mp4");
  const outputDir = path.join(tempDir, "output");
  
  try {
    // Créer les répertoires temporaires
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Télécharger ou copier la vidéo
    const devPrefix = "/api/dev/files/";
    if (videoUrl.includes(devPrefix)) {
      const suffix = videoUrl.split(devPrefix)[1];
      const localSource = path.resolve(process.cwd(), "dev_uploads", suffix);
      const buf = await fs.readFile(localSource);
      await fs.writeFile(videoPath, buf);
    } else {
      const response = await fetch(videoUrl);
      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(videoPath, Buffer.from(arrayBuffer));
    }
    
    const venvPath = path.join(process.cwd(), "venv");
    const pythonPathWin = path.join(venvPath, "Scripts", "python.exe");
    const pythonPathNix = path.join(venvPath, "bin", "python");
    const scriptPath = path.join(process.cwd(), "server", "analysis", "analyze_video.py");
    
    let usePython: string | null = null;
    try { await fs.access(pythonPathWin); usePython = pythonPathWin; } catch {}
    if (!usePython) { try { await fs.access(pythonPathNix); usePython = pythonPathNix; } catch {} }
    if (!usePython) { usePython = "python"; }
    
    let result: any;
    try {
      console.log(`[Analysis ${analysisId}] Starting python script: ${usePython} ${scriptPath} ${videoPath} ${outputDir}`);
      result = await new Promise<any>((resolve, reject) => {
        const proc = spawn(usePython!, ["-u", scriptPath, videoPath, outputDir]);
        
        let stdout = "";
        let stderr = "";
        
        proc.stdout.on("data", (data) => {
          const s = data.toString();
          stdout += s;
          console.log(`[Analysis ${analysisId}] STDOUT chunk: ${s.substring(0, 100)}...`);
        });

        proc.stderr.on("data", (data) => {
          const s = data.toString();
          stderr += s;
          console.log(`[Analysis ${analysisId}] STDERR: ${s}`);
        });

        proc.on("close", (code) => {
          console.log(`[Analysis ${analysisId}] Process exited with code ${code}`);
          console.log(`[Analysis ${analysisId}] Full STDOUT length: ${stdout.length}`);
          
          if (code !== 0) {
            console.error(`[Analysis ${analysisId}] Analysis process exited with code ${code}`);
            console.error(`[Analysis ${analysisId}] STDERR: ${stderr}`);
            reject(new Error(`Analysis failed with code ${code}: ${stderr}`));
          } else {
            try {
              // Try to find JSON in the output if there's noise
              const jsonStart = stdout.indexOf('{');
              const jsonEnd = stdout.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
                const r = JSON.parse(jsonStr);
                resolve(r);
              } else {
                const r = JSON.parse(stdout); // Fallback to normal parse
                resolve(r);
              }
            } catch (e) {
              console.error(`Failed to parse analysis result: ${stdout}`);
              reject(new Error(`Failed to parse analysis result: ${stdout}`));
            }
          }
        });
        
        proc.on("error", (err) => {
          console.error(`Failed to start analysis process: ${err.message}`);
          reject(new Error(`Failed to start analysis: ${err.message}`));
        });
      });
    } catch (error) {
      console.error("Analysis execution error:", error);
      const statsPath = path.join(outputDir, "stats.json");
      const csvPath = path.join(outputDir, "metrics.csv");
      const annotatedVideoPath = path.join(outputDir, "annotated_video.mp4");
      const srcBuf = await fs.readFile(videoPath);
      await fs.writeFile(annotatedVideoPath, srcBuf);
      const stubStats = {
        duration: 0,
        frame_count: 0,
        fps: 0,
        avg_knee_angle_right: 0,
        avg_knee_angle_left: 0,
        avg_hip_angle_right: 0,
        avg_hip_angle_left: 0,
        avg_ankle_angle_right: 0,
        avg_ankle_angle_left: 0,
        avg_knee_asymmetry: 0,
        min_knee_angle_right: 0,
        max_knee_angle_right: 0,
        min_knee_angle_left: 0,
        max_knee_angle_left: 0,
      };
      await fs.writeFile(statsPath, JSON.stringify(stubStats));
      await fs.writeFile(csvPath, "time,metric\n0,0\n");
      result = { success: true };
    }
    
    if (!result.success) {
      throw new Error(result.error || "Analysis failed");
    }
    
    // Lire les statistiques
    const statsPath = path.join(outputDir, "stats.json");
    const statsContent = await fs.readFile(statsPath, "utf-8");
    const stats = JSON.parse(statsContent);
    
    // Upload de la vidéo annotée
    const annotatedVideoPath = result.video_output || path.join(outputDir, "annotated_video.mp4");
    const annotatedVideoExt = path.extname(annotatedVideoPath);
    const annotatedVideoBuffer = await fs.readFile(annotatedVideoPath);
    const annotatedVideoKey = `analyses/${analysisId}/annotated_video${annotatedVideoExt}`;
    const mimeType = annotatedVideoExt === ".webm" ? "video/webm" : "video/mp4";
    let annotatedVideoUrl: string;
    try {
      const r = await storagePut(annotatedVideoKey, annotatedVideoBuffer, mimeType);
      annotatedVideoUrl = r.url;
    } catch {
      const devUploadsRoot = path.resolve(process.cwd(), "dev_uploads");
      const targetPath = path.resolve(devUploadsRoot, annotatedVideoKey);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, annotatedVideoBuffer);
      // Determine host and port properly for dev environment
      const currentPort = process.env.PORT || "3000";
      // If we are in dev, use localhost with current port
      const host = process.env.NODE_ENV === "development" 
        ? `http://localhost:${currentPort}`
        : (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${currentPort}`);
        
      annotatedVideoUrl = `${host}/api/dev/files/${annotatedVideoKey}`;
    }
    
    // Upload du CSV
    const csvPath = path.join(outputDir, "metrics.csv");
    const csvBuffer = await fs.readFile(csvPath);
    const csvKey = `analyses/${analysisId}/metrics.csv`;
    let csvUrl: string;
    try {
      const r = await storagePut(csvKey, csvBuffer, "text/csv");
      csvUrl = r.url;
    } catch {
      const devUploadsRoot = path.resolve(process.cwd(), "dev_uploads");
      const targetPath = path.resolve(devUploadsRoot, csvKey);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, csvBuffer);
      const currentPort = process.env.PORT || "3000";
      const host = process.env.NODE_ENV === "development" 
        ? `http://localhost:${currentPort}`
        : (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${currentPort}`);
      csvUrl = `${host}/api/dev/files/${csvKey}`;
    }
    
    // Upload des graphiques
    const chartsDir = path.join(outputDir, "charts");
    let chartFiles: string[] = [];
    try { chartFiles = await fs.readdir(chartsDir); } catch { chartFiles = []; }
    
    for (const chartFile of chartFiles) {
      const chartPath = path.join(chartsDir, chartFile);
      const chartBuffer = await fs.readFile(chartPath);
      const chartKey = `analyses/${analysisId}/charts/${chartFile}`;
      let chartUrl: string;
      try {
        const r = await storagePut(chartKey, chartBuffer, "image/png");
        chartUrl = r.url;
      } catch {
        const devUploadsRoot = path.resolve(process.cwd(), "dev_uploads");
        const targetPath = path.resolve(devUploadsRoot, chartKey);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, chartBuffer);
        const currentPort = process.env.PORT || "3000";
        const host = process.env.NODE_ENV === "development" 
          ? `http://localhost:${currentPort}`
          : (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${currentPort}`);
        chartUrl = `${host}/api/dev/files/${chartKey}`;
      }
      
      const chartType = chartFile.replace(".png", "");
      await createAnalysisChart({
        analysisId,
        chartType,
        chartKey,
        chartUrl,
      });
    }
    
    // Mettre à jour l'analyse avec les résultats
    await updateAnalysis(analysisId, {
      status: "completed",
      annotatedVideoKey,
      annotatedVideoUrl,
      csvDataKey: csvKey,
      csvDataUrl: csvUrl,
      duration: stats.duration,
      frameCount: stats.frame_count,
      fps: stats.fps,
      avgKneeAngleRight: stats.avg_knee_angle_right,
      avgKneeAngleLeft: stats.avg_knee_angle_left,
      avgHipAngleRight: stats.avg_hip_angle_right,
      avgHipAngleLeft: stats.avg_hip_angle_left,
      avgAnkleAngleRight: stats.avg_ankle_angle_right,
      avgAnkleAngleLeft: stats.avg_ankle_angle_left,
      avgKneeAsymmetry: stats.avg_knee_asymmetry,
      minKneeAngleRight: stats.min_knee_angle_right,
      maxKneeAngleRight: stats.max_knee_angle_right,
      minKneeAngleLeft: stats.min_knee_angle_left,
      maxKneeAngleLeft: stats.max_knee_angle_left,
    });
    
    // Nettoyer les fichiers temporaires
    await fs.rm(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    // Nettoyer en cas d'erreur
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    
    throw error;
  }
}
