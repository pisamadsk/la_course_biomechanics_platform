import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart3, FileVideo, TrendingUp, Upload, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="animate-pulse text-lg text-gray-600">Chargement...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">RunBio</span>
            </div>
            <div className="flex gap-4">
              <Link href="/dashboard">
                <Button variant="ghost">Tableau de bord</Button>
              </Link>
              <Link href="/upload">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Nouvelle analyse
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Bienvenue sur RunBio
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Analysez votre technique de course avec l'intelligence artificielle
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Link href="/upload">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Nouvelle analyse</CardTitle>
                  <CardDescription>
                    Téléchargez une vidéo de votre course pour obtenir une analyse biomécanique complète
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/dashboard">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <CardHeader>
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <CardTitle>Mes analyses</CardTitle>
                  <CardDescription>
                    Consultez l'historique de vos analyses et suivez votre progression
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <Activity className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Analyse Biomécanique
            <br />
            <span className="text-blue-600">de la Course à Pied</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Utilisez l'intelligence artificielle pour analyser votre technique de course, 
            détecter les déséquilibres et prévenir les blessures grâce à une analyse 
            biomécanique approfondie.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/upload">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                Commencer l'analyse
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-20">
          <Card className="border-2">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileVideo className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Détection de pose IA</CardTitle>
              <CardDescription>
                YOLOv8 Pose détecte 17 points clés de votre squelette pour une analyse précise de vos mouvements
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <CardTitle>Métriques détaillées</CardTitle>
              <CardDescription>
                Angles articulaires, asymétrie gauche/droite, vitesse du pied et recommandations personnalisées
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Résultats instantanés</CardTitle>
              <CardDescription>
                Vidéo annotée avec squelette superposé, graphiques d'évolution et export CSV des données
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Comment ça fonctionne ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Téléchargez votre vidéo</h3>
              <p className="text-gray-600">
                Filmez-vous en train de courir et uploadez la vidéo (MP4, AVI, WebM)
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Analyse automatique</h3>
              <p className="text-gray-600">
                L'IA détecte vos mouvements et calcule les angles articulaires en temps réel
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Recevez vos résultats</h3>
              <p className="text-gray-600">
                Consultez la vidéo annotée, les graphiques et les recommandations personnalisées
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          Prêt à améliorer votre technique ?
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Rejoignez les coureurs qui utilisent l'analyse biomécanique pour progresser 
          et prévenir les blessures
        </p>
        <Link href="/upload">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
            Commencer 
          </Button>
        </Link>
      </section>
    </div>
  );
}
