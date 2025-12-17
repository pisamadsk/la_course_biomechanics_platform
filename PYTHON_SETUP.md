# Configuration Python pour l'analyse biomécanique

## Installation des dépendances

L'analyse biomécanique nécessite Python 3.11 et plusieurs bibliothèques :

```bash
# Créer l'environnement virtuel avec Python 3.11
python3.11 -m venv venv

# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances
pip install ultralytics opencv-python-headless pandas matplotlib
```

## Dépendances principales

- **ultralytics** : YOLOv8 Pose pour la détection des points clés du squelette
- **opencv-python-headless** : Traitement vidéo sans interface graphique
- **pandas** : Manipulation des données et génération de CSV
- **matplotlib** : Création des graphiques de métriques

## Note importante

⚠️ **Utilisez Python 3.11** : Les versions plus récentes (3.13+) peuvent causer des conflits avec les modules compilés de PyTorch et OpenCV.

## Vérification de l'installation

```bash
source venv/bin/activate
python -c "import cv2, ultralytics, pandas, matplotlib; print('✓ Installation réussie')"
```

## Utilisation

Le script d'analyse est exécuté automatiquement par le backend Node.js lors de l'upload d'une vidéo. Il n'est pas nécessaire de l'exécuter manuellement.
