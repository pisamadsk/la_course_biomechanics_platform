import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Activity, AlertCircle, CheckCircle2, Upload as UploadIcon, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const uploadVideoMutation = trpc.analysis.uploadVideo.useMutation();
  const createAnalysisMutation = trpc.analysis.create.useMutation();
  const uploadVideoPublicMutation = trpc.analysis.uploadVideoPublic.useMutation();
  const createAnalysisPublicMutation = trpc.analysis.createPublic.useMutation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  const isLoggedIn = !!user;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Vérifier le type de fichier
    const validTypes = ["video/mp4", "video/avi", "video/webm", "video/quicktime"];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Format de fichier non supporté. Utilisez MP4, AVI ou WebM.");
      return;
    }

    // Vérifier la taille (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (selectedFile.size > maxSize) {
      toast.error("Le fichier est trop volumineux. Taille maximum : 100MB");
      return;
    }

    setFile(selectedFile);

    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simuler la progression de lecture du fichier
      setUploadProgress(10);

      // Lire le fichier en base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(",")[1];
            resolve(base64);
          } else {
             reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      setUploadProgress(30);

      // Upload vers S3
      const uploadResult = isLoggedIn
        ? await uploadVideoMutation.mutateAsync({
            filename: file.name,
            contentType: file.type,
            base64Data,
          })
        : await uploadVideoPublicMutation.mutateAsync({
            filename: file.name,
            contentType: file.type,
            base64Data,
          });

      setUploadProgress(60);

      // Créer l'analyse
      const analysisResult = isLoggedIn
        ? await createAnalysisMutation.mutateAsync({
            videoUrl: uploadResult.url,
            videoKey: uploadResult.key,
          })
        : await createAnalysisPublicMutation.mutateAsync({
            videoUrl: uploadResult.url,
            videoKey: uploadResult.key,
          });

      setUploadProgress(100);

      toast.success("Vidéo uploadée avec succès ! L'analyse est en cours...");

      // Rediriger vers la page d'analyse
      const target = `/analysis/${analysisResult.analysisId}`;
      setTimeout(() => {
        try {
          setLocation(target);
        } catch {
          window.location.href = target;
        }
      }, 800);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erreur lors de l'upload");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Activity className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">RunBio</span>
            </div>
          </Link>
          <div className="flex gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Tableau de bord</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Nouvelle analyse</h1>
          <p className="text-gray-600">
            Téléchargez une vidéo de votre course pour obtenir une analyse biomécanique complète
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Upload de vidéo</CardTitle>
            <CardDescription>
              Formats acceptés : MP4, AVI, WebM • Taille maximum : 100MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Cliquez pour sélectionner une vidéo
                </p>
                <p className="text-sm text-gray-500">
                  ou glissez-déposez votre fichier ici
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/avi,video/webm,video/quicktime"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  {preview && (
                    <video
                      key={preview}
                      src={preview}
                      controls
                      className="w-full max-h-96 object-contain"
                    />
                  )}
                  <button
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2"
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {!uploading && (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Upload en cours...</span>
                      <span className="font-medium text-blue-600">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Conseils pour une meilleure analyse :</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>Filmez de profil pour capturer tout le corps</li>
                      <li>Assurez-vous d'un bon éclairage</li>
                      <li>Évitez les arrière-plans encombrés</li>
                      <li>Durée recommandée : 10-30 secondes</li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4 mr-2" />
                      Lancer l'analyse
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
