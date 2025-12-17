import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Activity, AlertCircle, Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const privateQuery = trpc.analysis.get.useQuery(
    { id: parseInt(id || "0") },
    {
      enabled: !!user && !!id,
      refetchInterval(query) {
        const status = query?.state?.data?.analysis?.status;
        return status && status !== "completed" ? 2000 : false;
      },
    }
  );
  const publicQuery = trpc.analysis.getPublic.useQuery(
    { id: parseInt(id || "0") },
    {
      enabled: !user && !!id,
      refetchInterval(query) {
        const status = query?.state?.data?.analysis?.status;
        return status && status !== "completed" ? 2000 : false;
      },
    }
  );

  const isLoading = authLoading || privateQuery.isLoading || publicQuery.isLoading;
  const error = privateQuery.error ?? publicQuery.error;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const data = privateQuery.data ?? publicQuery.data;

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-center text-gray-600">
              {error?.message || "Analyse introuvable"}
            </p>
            <Link href="/dashboard">
              <Button className="w-full mt-4">Retour au tableau de bord</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { analysis, charts } = data;

  if (analysis.status === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Analyse échouée
            </p>
            <p className="text-gray-600">
              {analysis.errorMessage || "Une erreur est survenue lors du traitement."}
            </p>
            <Link href="/upload">
              <Button variant="outline" className="mt-4">
                Réessayer avec une autre vidéo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (analysis.status !== "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Analyse en cours...
            </p>
            <p className="text-gray-600">
              Cela peut prendre quelques minutes. Vous pouvez fermer cette page.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">
                Retour au tableau de bord
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRecommendations = () => {
    const recommendations: Array<{ type: "warning" | "success" | "info"; text: string }> = [];

    if (analysis.avgKneeAngleRight && analysis.avgKneeAngleRight < 140) {
      recommendations.push({
        type: "warning",
        text: "Extension du genou droit insuffisante (< 140°). Travaillez sur l'extension complète de la jambe.",
      });
    }

    if (analysis.avgKneeAngleLeft && analysis.avgKneeAngleLeft < 140) {
      recommendations.push({
        type: "warning",
        text: "Extension du genou gauche insuffisante (< 140°). Travaillez sur l'extension complète de la jambe.",
      });
    }

    if (analysis.avgKneeAsymmetry && analysis.avgKneeAsymmetry > 10) {
      recommendations.push({
        type: "warning",
        text: `Asymétrie importante détectée (${analysis.avgKneeAsymmetry.toFixed(1)}°). Cela peut indiquer un déséquilibre musculaire ou un risque de blessure.`,
      });
    } else {
      recommendations.push({
        type: "success",
        text: "Bonne symétrie entre les deux jambes. Continuez ainsi !",
      });
    }

    if (analysis.minKneeAngleRight && analysis.minKneeAngleRight < 100) {
      recommendations.push({
        type: "info",
        text: "Flexion importante du genou droit détectée. Assurez-vous que votre technique de course est adaptée.",
      });
    }

    return recommendations;
  };

  const recommendations = getRecommendations();

  const chartsByType: Record<string, string> = {};
  charts.forEach((chart) => {
    chartsByType[chart.chartType] = chart.chartUrl;
  });

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

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">← Retour</Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Analyse #{analysis.id}
          </h1>
          <p className="text-gray-600">
            Résultats de l'analyse biomécanique de votre course
          </p>
        </div>

        {/* Statistiques globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Durée</CardDescription>
              <CardTitle className="text-3xl">{analysis.duration?.toFixed(1)}s</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Images</CardDescription>
              <CardTitle className="text-3xl">{analysis.frameCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>FPS</CardDescription>
              <CardTitle className="text-3xl">{analysis.fps?.toFixed(0)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Asymétrie</CardDescription>
              <CardTitle className="text-3xl text-orange-600">
                {analysis.avgKneeAsymmetry?.toFixed(1)}°
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recommandations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recommandations personnalisées</CardTitle>
            <CardDescription>
              Basées sur les seuils biomécaniques standards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`flex gap-3 p-4 rounded-lg ${
                  rec.type === "warning"
                    ? "bg-yellow-50 border border-yellow-200"
                    : rec.type === "success"
                    ? "bg-green-50 border border-green-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                {rec.type === "warning" ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                ) : rec.type === "success" ? (
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    rec.type === "warning"
                      ? "text-yellow-800"
                      : rec.type === "success"
                      ? "text-green-800"
                      : "text-blue-800"
                  }`}
                >
                  {rec.text}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Vidéo annotée et graphiques */}
        <Tabs defaultValue="video" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
            <TabsTrigger value="video">Vidéo</TabsTrigger>
            <TabsTrigger value="knee">Genoux</TabsTrigger>
            <TabsTrigger value="asymmetry">Asymétrie</TabsTrigger>
            <TabsTrigger value="hip">Hanches</TabsTrigger>
            <TabsTrigger value="ankle">Chevilles</TabsTrigger>
            <TabsTrigger value="speed">Vitesse</TabsTrigger>
          </TabsList>

          <TabsContent value="video">
            <Card>
              <CardHeader>
                <CardTitle>Vidéo annotée</CardTitle>
                <CardDescription>
                  Squelette superposé avec angles articulaires et métriques en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.annotatedVideoUrl ? (
                  <video
                    src={analysis.annotatedVideoUrl}
                    controls
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Vidéo non disponible</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knee">
            <Card>
              <CardHeader>
                <CardTitle>Évolution des angles de genou</CardTitle>
                <CardDescription>
                  Angles du genou droit et gauche au cours du temps
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsByType.knee_angles ? (
                  <img
                    src={chartsByType.knee_angles}
                    alt="Angles de genou"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Graphique non disponible</p>
                )}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Genou droit moyen</div>
                    <div className="text-2xl font-bold text-green-600">
                      {analysis.avgKneeAngleRight?.toFixed(1)}°
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Min: {analysis.minKneeAngleRight?.toFixed(0)}° • Max:{" "}
                      {analysis.maxKneeAngleRight?.toFixed(0)}°
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Genou gauche moyen</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {analysis.avgKneeAngleLeft?.toFixed(1)}°
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Min: {analysis.minKneeAngleLeft?.toFixed(0)}° • Max:{" "}
                      {analysis.maxKneeAngleLeft?.toFixed(0)}°
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="asymmetry">
            <Card>
              <CardHeader>
                <CardTitle>Asymétrie des genoux</CardTitle>
                <CardDescription>
                  Différence absolue entre genou droit et gauche
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsByType.asymmetry ? (
                  <img
                    src={chartsByType.asymmetry}
                    alt="Asymétrie"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Graphique non disponible</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hip">
            <Card>
              <CardHeader>
                <CardTitle>Évolution des angles de hanche</CardTitle>
                <CardDescription>
                  Angles de hanche droit et gauche au cours du temps
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsByType.hip_angles ? (
                  <img
                    src={chartsByType.hip_angles}
                    alt="Angles de hanche"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Graphique non disponible</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ankle">
            <Card>
              <CardHeader>
                <CardTitle>Évolution des angles de cheville</CardTitle>
                <CardDescription>
                  Angles de cheville droit et gauche au cours du temps
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsByType.ankle_angles ? (
                  <img
                    src={chartsByType.ankle_angles}
                    alt="Angles de cheville"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Graphique non disponible</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speed">
            <Card>
              <CardHeader>
                <CardTitle>Vitesse du pied droit</CardTitle>
                <CardDescription>
                  Évolution de la vitesse de la cheville droite
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsByType.foot_speed ? (
                  <img
                    src={chartsByType.foot_speed}
                    alt="Vitesse du pied"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <p className="text-gray-500">Graphique non disponible</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export CSV */}
        {analysis.csvDataUrl && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Export des données</CardTitle>
              <CardDescription>
                Téléchargez les données brutes de l'analyse (CSV)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href={analysis.csvDataUrl} download>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger le CSV
                </Button>
              </a>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
