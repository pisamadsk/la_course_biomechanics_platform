import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, analyses, analysisCharts, InsertAnalysis, InsertAnalysisChart, type Analysis, type AnalysisChart, type User } from "../drizzle/schema";
import { ENV } from './_core/env';
import fs from "fs";
import path from "path";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

type DevStore = {
  users: User[];
  analyses: Analysis[];
  analysisCharts: AnalysisChart[];
  seq: { userId: number; analysisId: number; chartId: number };
};

function getDevStorePath() {
  const root = path.resolve(process.cwd(), "dev_uploads");
  const file = path.resolve(root, "dev_db.json");
  try {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    if (!fs.existsSync(file)) {
      const initial: DevStore = {
        users: [],
        analyses: [],
        analysisCharts: [],
        seq: { userId: 1, analysisId: 1, chartId: 1 },
      };
      fs.writeFileSync(file, JSON.stringify(initial, null, 2));
    }
  } catch {}
  return file;
}

function readDevStore(): DevStore {
  const file = getDevStorePath();
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as DevStore;
  } catch {
    return { users: [], analyses: [], analysisCharts: [], seq: { userId: 1, analysisId: 1, chartId: 1 } };
  }
}

function writeDevStore(store: DevStore) {
  const file = getDevStorePath();
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    const existing = store.users.find(u => u.openId === user.openId);
    const now = new Date();
    if (existing) {
      existing.name = user.name ?? existing.name ?? null;
      existing.email = user.email ?? existing.email ?? null;
      existing.loginMethod = user.loginMethod ?? existing.loginMethod ?? null;
      existing.lastSignedIn = user.lastSignedIn ?? now;
      if (user.role) existing.role = user.role;
      existing.updatedAt = now;
    } else {
      const id = store.seq.userId++;
      store.users.push({
        id,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      });
    }
    writeDevStore(store);
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    return store.users.find(u => u.openId === openId);
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Analyses biomécaniques =====

export async function createAnalysis(data: InsertAnalysis) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    const now = new Date();
    const id = store.seq.analysisId++;
    store.analyses.push({
      id,
      userId: data.userId!,
      originalVideoKey: data.originalVideoKey!,
      originalVideoUrl: data.originalVideoUrl!,
      annotatedVideoKey: null,
      annotatedVideoUrl: null,
      csvDataKey: null,
      csvDataUrl: null,
      duration: null,
      frameCount: null as any,
      fps: null,
      avgKneeAngleRight: null,
      avgKneeAngleLeft: null,
      avgHipAngleRight: null,
      avgHipAngleLeft: null,
      avgAnkleAngleRight: null,
      avgAnkleAngleLeft: null,
      avgKneeAsymmetry: null,
      minKneeAngleRight: null,
      maxKneeAngleRight: null,
      minKneeAngleLeft: null,
      maxKneeAngleLeft: null,
      status: (data.status as any) ?? "pending",
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    writeDevStore(store);
    return id;
  }
  
  const result = await db.insert(analyses).values(data);
  return result[0].insertId;
}

export async function getAnalysisById(id: number) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    return store.analyses.find(a => a.id === id);
  }
  
  const result = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserAnalyses(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    return store.analyses.filter(a => a.userId === userId).sort((a, b) => +b.createdAt - +a.createdAt);
  }
  
  return db.select().from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt));
}

export async function updateAnalysis(id: number, data: Partial<InsertAnalysis>) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    const target = store.analyses.find(a => a.id === id);
    if (target) {
      Object.assign(target, data);
      target.updatedAt = new Date();
      writeDevStore(store);
    }
    return;
  }
  
  await db.update(analyses).set(data).where(eq(analyses.id, id));
}

export async function createAnalysisChart(data: InsertAnalysisChart) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    const id = store.seq.chartId++;
    store.analysisCharts.push({
      id,
      analysisId: data.analysisId!,
      chartType: data.chartType!,
      chartKey: data.chartKey!,
      chartUrl: data.chartUrl!,
      createdAt: new Date(),
    });
    writeDevStore(store);
    return;
  }
  
  await db.insert(analysisCharts).values(data);
}

export async function getAnalysisCharts(analysisId: number) {
  const db = await getDb();
  if (!db) {
    const store = readDevStore();
    return store.analysisCharts.filter(c => c.analysisId === analysisId);
  }
  
  return db.select().from(analysisCharts)
    .where(eq(analysisCharts.analysisId, analysisId));
}
