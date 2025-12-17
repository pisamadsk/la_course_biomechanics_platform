import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Activity, Clock, FileVideo, Loader2, TrendingUp, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: analyses, isLoading } = trpc.analysis.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000, // Rafraîchir toutes les 5 secondes pour voir les mises à jour de statut
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Terminée</Badge>;
      case "processing":
        return <Badge className="bg-blue-500">En cours</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case "failed":
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
            <Link href="/upload">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Nouvelle analyse
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Tableau de bord</h1>
          <p className="text-gray-600">
            Consultez l'historique de vos analyses biomécaniques
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !analyses || analyses.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <FileVideo className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Aucune analyse pour le moment
              </h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                Commencez par télécharger une vidéo de votre course pour obtenir 
                votre première analyse biomécanique
              </p>
              <Link href="/upload">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger une vidéo
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {analyses.map((analysis) => (
              <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">
                          Analyse #{analysis.id}
                        </CardTitle>
                        {getStatusBadge(analysis.status)}
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDistanceToNow(new Date(analysis.createdAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </CardDescription>
                    </div>
                    {analysis.status === "completed" && (
                      <Link href={`/analysis/${analysis.id}`}>
                        <Button variant="outline">Voir les résultats</Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>

                {analysis.status === "completed" && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Durée</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {analysis.duration?.toFixed(1)}s
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Genou droit</div>
                        <div className="text-2xl font-bold text-green-600">
                          {analysis.avgKneeAngleRight?.toFixed(0)}°
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Genou gauche</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {analysis.avgKneeAngleLeft?.toFixed(0)}°
                        </div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Asymétrie</div>
                        <div className="text-2xl font-bold text-orange-600">
                          {analysis.avgKneeAsymmetry?.toFixed(1)}°
                        </div>
                      </div>
                    </div>

                    {analysis.avgKneeAsymmetry && analysis.avgKneeAsymmetry > 10 && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                        <TrendingUp className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                          <p className="font-medium">Asymétrie détectée</p>
                          <p>
                            Une différence de plus de 10° entre les genoux a été détectée. 
                            Consultez l'analyse complète pour plus de détails.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}

                {analysis.status === "processing" && (
                  <CardContent>
                    <div className="flex items-center gap-3 text-blue-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyse en cours... Cela peut prendre quelques minutes.</span>
                    </div>
                  </CardContent>
                )}

                {analysis.status === "failed" && (
                  <CardContent>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">
                        {analysis.errorMessage || "Une erreur s'est produite lors de l'analyse."}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
