#!/usr/bin/env python3.11
"""
Script d'analyse biomécanique de la course à pied
Utilise YOLOv8 Pose pour détecter les points clés et calculer les métriques
"""
import sys
import json
import cv2
import numpy as np
import csv
import os
from ultralytics import YOLO
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Backend non-interactif
import matplotlib.pyplot as plt

def calculate_angle(p1, p2, p3):
    """Calcule l'angle (en degrés) au point p2 formé par p1-p2-p3."""
    p1 = np.array(p1, dtype=float)
    p2 = np.array(p2, dtype=float)
    p3 = np.array(p3, dtype=float)
    
    v1 = p1 - p2
    v2 = p3 - p2
    
    if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
        return np.nan
    
    v1_u = v1 / np.linalg.norm(v1)
    v2_u = v2 / np.linalg.norm(v2)
    
    dot = np.clip(np.dot(v1_u, v2_u), -1.0, 1.0)
    angle_rad = np.arccos(dot)
    angle_deg = np.degrees(angle_rad)
    return float(angle_deg)

def distance(p1, p2):
    """Calcule la distance euclidienne entre deux points."""
    p1 = np.array(p1, dtype=float)
    p2 = np.array(p2, dtype=float)
    return float(np.linalg.norm(p1 - p2))

def analyze_video(video_path, output_dir):
    """Analyse une vidéo de course et génère les résultats."""
    
    # Créer les répertoires de sortie
    os.makedirs(output_dir, exist_ok=True)
    charts_dir = os.path.join(output_dir, "charts")
    os.makedirs(charts_dir, exist_ok=True)
    
    # Chemins de sortie
    video_output = os.path.join(output_dir, "annotated_video.mp4")
    csv_output = os.path.join(output_dir, "metrics.csv")
    
    # Charger le modèle YOLOv8-Pose
    model_path = os.path.join(os.path.dirname(__file__), "yolov8n-pose.pt")
    model = YOLO(model_path)
    
    # Ouvrir la vidéo
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Impossible d'ouvrir la vidéo : {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0
    
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Writer vidéo (MP4 + H264)
    # Utilisation de avc1 (H.264) en priorité pour la compatibilité web.
    # OpenH264 DLL doit être présente.
    
    # Ajouter le répertoire courant au PATH pour trouver la DLL OpenH264 si elle est à la racine
    os.environ['PATH'] = os.getcwd() + os.pathsep + os.environ['PATH']
    
    current_video_output = os.path.join(output_dir, "annotated_video.mp4")
    video_output = current_video_output
    
    try:
        print("DEBUG: Trying avc1 (H.264) codec...", file=sys.stderr)
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        out = cv2.VideoWriter(current_video_output, fourcc, fps, (width, height))
        
        if not out.isOpened():
             print("DEBUG: avc1 codec failed, trying vp80 (WebM)", file=sys.stderr)
             current_video_output = os.path.join(output_dir, "annotated_video.webm")
             fourcc = cv2.VideoWriter_fourcc(*"vp80")
             out = cv2.VideoWriter(current_video_output, fourcc, fps, (width, height))
             
             if not out.isOpened():
                 print("DEBUG: vp80 codec failed, trying VP80 (WebM)", file=sys.stderr)
                 fourcc = cv2.VideoWriter_fourcc(*"VP80")
                 out = cv2.VideoWriter(current_video_output, fourcc, fps, (width, height))
                 
                 if not out.isOpened():
                      print("DEBUG: VP80 codec failed, falling back to mp4v", file=sys.stderr)
                      current_video_output = os.path.join(output_dir, "annotated_video.mp4")
                      fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                      out = cv2.VideoWriter(current_video_output, fourcc, fps, (width, height))
    except Exception as e:
        print(f"DEBUG: Error creating video writer: {e}, falling back to mp4v", file=sys.stderr)
        current_video_output = os.path.join(output_dir, "annotated_video.mp4")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(current_video_output, fourcc, fps, (width, height))
    
    print(f"DEBUG: Video writer initialized. Output: {current_video_output}", file=sys.stderr)
    video_output = current_video_output
    
    # CSV
    fieldnames = [
        "frame", "time_s",
        "knee_angle_right", "knee_angle_left",
        "hip_angle_right", "hip_angle_left",
        "ankle_angle_right", "ankle_angle_left",
        "foot_speed_right", "foot_speed_norm"
    ]
    csv_file = open(csv_output, mode="w", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()
    
    prev_right_ankle = None
    prev_time = None
    frame_idx = 0
    
    KNEE_EXTENSION_MIN = 140
    ASYM_THRESHOLD = 10
    
    try:
        print(f"DEBUG: Starting video loop. Frames: {frame_count}, FPS: {fps}", file=sys.stderr)
        while True:
            ret, frame = cap.read()
            if not ret:
                print("DEBUG: End of video reached or read failed", file=sys.stderr)
                break
            
            frame_idx += 1
            if frame_idx % 10 == 0:
                print(f"DEBUG: Processing frame {frame_idx}/{frame_count}", file=sys.stderr)

            time_s = frame_idx / fps
            
            results = model(frame, verbose=False)[0]
            annotated = frame.copy()
            
            row = {
                "frame": frame_idx,
                "time_s": round(time_s, 3),
                "knee_angle_right": np.nan,
                "knee_angle_left": np.nan,
                "hip_angle_right": np.nan,
                "hip_angle_left": np.nan,
                "ankle_angle_right": np.nan,
                "ankle_angle_left": np.nan,
                "foot_speed_right": np.nan,
                "foot_speed_norm": np.nan
            }
            
            if results.keypoints is not None and len(results.keypoints) > 0:
                # Personne principale = plus grande bbox
                if results.boxes is not None and len(results.boxes) > 0:
                    boxes = results.boxes.xyxy.cpu().numpy()
                    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
                    main_idx = int(np.argmax(areas))
                else:
                    main_idx = 0
                
                kpts = results.keypoints.xy[main_idx].cpu().numpy()
                
                # Indices COCO
                LSHOULDER, RSHOULDER = 5, 6
                LHIP, RHIP = 11, 12
                LKNEE, RKNEE = 13, 14
                LANKLE, RANKLE = 15, 16
                
                l_shoulder = tuple(kpts[LSHOULDER])
                r_shoulder = tuple(kpts[RSHOULDER])
                l_hip = tuple(kpts[LHIP])
                r_hip = tuple(kpts[RHIP])
                l_knee = tuple(kpts[LKNEE])
                r_knee = tuple(kpts[RKNEE])
                l_ankle = tuple(kpts[LANKLE])
                r_ankle = tuple(kpts[RANKLE])
                
                # Calcul des angles
                knee_angle_right = calculate_angle(r_hip, r_knee, r_ankle)
                knee_angle_left = calculate_angle(l_hip, l_knee, l_ankle)
                hip_angle_right = calculate_angle(r_shoulder, r_hip, r_knee)
                hip_angle_left = calculate_angle(l_shoulder, l_hip, l_knee)
                ankle_angle_right = calculate_angle(r_knee, r_ankle, (r_ankle[0], r_ankle[1] + 50))
                ankle_angle_left = calculate_angle(l_knee, l_ankle, (l_ankle[0], l_ankle[1] + 50))
                
                row["knee_angle_right"] = round(knee_angle_right, 2)
                row["knee_angle_left"] = round(knee_angle_left, 2)
                row["hip_angle_right"] = round(hip_angle_right, 2)
                row["hip_angle_left"] = round(hip_angle_left, 2)
                row["ankle_angle_right"] = round(ankle_angle_right, 2)
                row["ankle_angle_left"] = round(ankle_angle_left, 2)
                
                # Vitesse du pied
                foot_speed = np.nan
                if prev_right_ankle is not None and prev_time is not None:
                    dt = time_s - prev_time
                    if dt > 0:
                        dist_pix = distance(r_ankle, prev_right_ankle)
                        foot_speed = dist_pix / dt
                        row["foot_speed_right"] = round(foot_speed, 2)
                
                prev_right_ankle = r_ankle
                prev_time = time_s
                
                # Vitesse normalisée
                body_len = np.max(kpts[:, 1]) - np.min(kpts[:, 1])
                if body_len > 0 and not np.isnan(foot_speed):
                    foot_speed_norm = foot_speed / body_len
                    row["foot_speed_norm"] = round(foot_speed_norm, 2)
                
                # Dessin du squelette
                LOWER_BODY_IDS = [LSHOULDER, RSHOULDER, LHIP, RHIP, LKNEE, RKNEE, LANKLE, RANKLE]
                
                for idx in LOWER_BODY_IDS:
                    x, y = kpts[idx]
                    cv2.circle(annotated, (int(x), int(y)), 5, (0, 255, 0), -1)
                
                skeleton_edges = [
                    (LSHOULDER, RSHOULDER), (LSHOULDER, LHIP), (RSHOULDER, RHIP), (LHIP, RHIP),
                    (LHIP, LKNEE), (LKNEE, LANKLE), (RHIP, RKNEE), (RKNEE, RANKLE),
                ]
                for i, j in skeleton_edges:
                    x1, y1 = kpts[i]
                    x2, y2 = kpts[j]
                    cv2.line(annotated, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
                
                # Affichage des angles
                def put_angle(text, pos, color):
                    cv2.putText(annotated, text, (int(pos[0]), int(pos[1])),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                
                knee_color_right = (0, 255, 0) if knee_angle_right >= KNEE_EXTENSION_MIN else (0, 0, 255)
                knee_color_left = (0, 255, 0) if knee_angle_left >= KNEE_EXTENSION_MIN else (0, 0, 255)
                
                put_angle(f"KR {knee_angle_right:.0f}°", r_knee, knee_color_right)
                put_angle(f"KL {knee_angle_left:.0f}°", l_knee, knee_color_left)
                put_angle(f"HR {hip_angle_right:.0f}°", r_hip, (255, 255, 0))
                put_angle(f"HL {hip_angle_left:.0f}°", l_hip, (255, 255, 0))
                put_angle(f"AR {ankle_angle_right:.0f}°", r_ankle, (255, 0, 255))
                put_angle(f"AL {ankle_angle_left:.0f}°", l_ankle, (255, 0, 255))
                
                # HUD
                hud_x, hud_y = 10, 25
                line_h = 22
                
                knee_diff = np.nan
                if not np.isnan(knee_angle_right) and not np.isnan(knee_angle_left):
                    knee_diff = abs(knee_angle_right - knee_angle_left)
                
                hud_color = (0, 255, 0)
                if not np.isnan(knee_diff) and knee_diff > ASYM_THRESHOLD:
                    hud_color = (0, 165, 255)
                if knee_angle_right < 100 or knee_angle_left < 100:
                    hud_color = (0, 0, 255)
                
                hud_lines = [
                    f"t = {time_s:.2f} s",
                    f"Genou D/G = {knee_angle_right:.0f}° / {knee_angle_left:.0f}°",
                    f"Diff genou = {knee_diff:.1f}°" if not np.isnan(knee_diff) else "Diff genou = N/A",
                    f"v pied D = {row['foot_speed_right']:.0f} px/s" if not np.isnan(row["foot_speed_right"]) else "v pied D = N/A",
                ]
                
                overlay = annotated.copy()
                cv2.rectangle(overlay, (hud_x - 5, hud_y - 20),
                            (hud_x + 340, hud_y + line_h * len(hud_lines)), (0, 0, 0), -1)
                cv2.addWeighted(overlay, 0.4, annotated, 0.6, 0, annotated)
                
                for i, txt in enumerate(hud_lines):
                    if txt:
                        cv2.putText(annotated, txt, (hud_x, hud_y + i * line_h),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
            
            writer.writerow(row)
            out.write(annotated)
    
    finally:
        cap.release()
        out.release()
        csv_file.close()
    
    # Générer les graphiques
    df = pd.read_csv(csv_output)
    df = df.dropna(how="all")
    df["knee_diff"] = np.abs(df["knee_angle_right"] - df["knee_angle_left"])
    
    def save_fig(name):
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, name), dpi=150, bbox_inches='tight')
        plt.close()
    
    # Graphique des angles de genou
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["knee_angle_right"], label="Genou droit", linewidth=2)
    plt.plot(df["time_s"], df["knee_angle_left"], "--", label="Genou gauche", linewidth=2)
    plt.axhline(140, color="red", linestyle=":", alpha=0.5, label="Seuil extension (140°)")
    plt.xlabel("Temps (s)", fontsize=12)
    plt.ylabel("Angle du genou (°)", fontsize=12)
    plt.title("Évolution de l'angle du genou", fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    save_fig("knee_angles.png")
    
    # Graphique d'asymétrie
    plt.figure(figsize=(10, 4))
    plt.plot(df["time_s"], df["knee_diff"], linewidth=2, color='#e74c3c')
    plt.axhline(10, color="red", linestyle="--", label="Seuil asymétrie (10°)")
    plt.xlabel("Temps (s)", fontsize=12)
    plt.ylabel("Différence (°)", fontsize=12)
    plt.title("Asymétrie des genoux (|Droit - Gauche|)", fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    save_fig("asymmetry.png")
    
    # Graphique des hanches
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["hip_angle_right"], label="Hanche droite", linewidth=2)
    plt.plot(df["time_s"], df["hip_angle_left"], "--", label="Hanche gauche", linewidth=2)
    plt.xlabel("Temps (s)", fontsize=12)
    plt.ylabel("Angle de hanche (°)", fontsize=12)
    plt.title("Évolution de l'angle de hanche", fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    save_fig("hip_angles.png")
    
    # Graphique des chevilles
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["ankle_angle_right"], label="Cheville droite", linewidth=2)
    plt.plot(df["time_s"], df["ankle_angle_left"], "--", label="Cheville gauche", linewidth=2)
    plt.xlabel("Temps (s)", fontsize=12)
    plt.ylabel("Angle de cheville (°)", fontsize=12)
    plt.title("Évolution de l'angle de cheville", fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    save_fig("ankle_angles.png")
    
    # Graphique de vitesse
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["foot_speed_right"], linewidth=2, color='#3498db')
    plt.xlabel("Temps (s)", fontsize=12)
    plt.ylabel("Vitesse pied droit (px/s)", fontsize=12)
    plt.title("Vitesse de la cheville droite", fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)
    save_fig("foot_speed.png")
    
    # Calculer les statistiques
    def safe_float(val):
        if pd.isna(val) or np.isnan(val):
            return None
        return float(val)

    stats = {
        "duration": safe_float(frame_count / fps),
        "frame_count": int(frame_count),
        "fps": safe_float(fps),
        "avg_knee_angle_right": safe_float(df["knee_angle_right"].mean()),
        "avg_knee_angle_left": safe_float(df["knee_angle_left"].mean()),
        "avg_hip_angle_right": safe_float(df["hip_angle_right"].mean()),
        "avg_hip_angle_left": safe_float(df["hip_angle_left"].mean()),
        "avg_ankle_angle_right": safe_float(df["ankle_angle_right"].mean()),
        "avg_ankle_angle_left": safe_float(df["ankle_angle_left"].mean()),
        "avg_knee_asymmetry": safe_float(df["knee_diff"].mean()),
        "min_knee_angle_right": safe_float(df["knee_angle_right"].min()),
        "max_knee_angle_right": safe_float(df["knee_angle_right"].max()),
        "min_knee_angle_left": safe_float(df["knee_angle_left"].min()),
        "max_knee_angle_left": safe_float(df["knee_angle_left"].max()),
    }
    
    # Sauvegarder les statistiques
    with open(os.path.join(output_dir, "stats.json"), "w") as f:
        json.dump(stats, f, indent=2)
    
    return {
        "success": True,
        "stats": stats,
        "video_output": video_output,
        "csv_output": csv_output,
        "charts_dir": charts_dir
    }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: analyze_video.py <video_path> <output_dir>"}))
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        result = analyze_video(video_path, output_dir)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
