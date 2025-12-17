import cv2
import numpy as np
import csv
import os
from ultralytics import YOLO
import pandas as pd
import matplotlib.pyplot as plt

# =========================
#   Fonctions utilitaires
# =========================

def calculate_angle(p1, p2, p3):
    """
    Calcule l'angle (en degrés) au point p2 formé par p1-p2-p3.
    p1, p2, p3 : (x, y)
    """
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
    p1 = np.array(p1, dtype=float)
    p2 = np.array(p2, dtype=float)
    return float(np.linalg.norm(p1 - p2))


# =========================
#   Paramètres principaux
# =========================

VIDEO_INPUT = "video vision par ordinateur .mp4"   # <-- mets ici ta vidéo
VIDEO_OUTPUT = "course3.avi"
CSV_OUTPUT = "ourse3.csv"
FIG_DIR = "figures_course"

KNEE_EXTENSION_MIN = 140   # genou "bien tendu" si angle >= 140°
ASYM_THRESHOLD = 10        # asymétrie genou D/G (en degrés)


# =========================
#   1) ANALYSE VIDÉO + CSV
# =========================

def analyse_video():
    print("[INFO] Chargement du modèle YOLOv8-Pose...")
    model = YOLO("yolov8n-pose.pt")

    cap = cv2.VideoCapture(VIDEO_INPUT)
    if not cap.isOpened():
        raise RuntimeError(f"Impossible d'ouvrir la vidéo d'entrée : {VIDEO_INPUT}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if width <= 0 or height <= 0:
        cap.release()
        raise RuntimeError("Dimensions vidéo invalides.")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[INFO] Vidéo : {frame_count} frames, {fps:.1f} fps, {width}x{height}")

    # Writer vidéo : AVI + XVID (stable Windows)
    fourcc = cv2.VideoWriter_fourcc(*"XVID")
    out = cv2.VideoWriter(VIDEO_OUTPUT, fourcc, fps, (width, height))
    if not out.isOpened():
        cap.release()
        raise RuntimeError("Impossible de créer la vidéo de sortie (codec).")

    # CSV
    fieldnames = [
        "frame", "time_s",
        "knee_angle_right", "knee_angle_left",
        "hip_angle_right", "hip_angle_left",
        "ankle_angle_right", "ankle_angle_left",
        "foot_speed_right", "foot_speed_norm"
    ]
    csv_file = open(CSV_OUTPUT, mode="w", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()

    prev_right_ankle = None
    prev_time = None

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
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
                # personne principale = plus grande bbox
                if results.boxes is not None and len(results.boxes) > 0:
                    boxes = results.boxes.xyxy.cpu().numpy()
                    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
                    main_idx = int(np.argmax(areas))
                else:
                    main_idx = 0

                kpts = results.keypoints.xy[main_idx].cpu().numpy()  # (17, 2)

                # indices COCO
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

                # ---- Angles ----
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

                # ---- Vitesse pied droit (cheville) ----
                foot_speed = np.nan
                if prev_right_ankle is not None and prev_time is not None:
                    dt = time_s - prev_time
                    if dt > 0:
                        dist_pix = distance(r_ankle, prev_right_ankle)
                        foot_speed = dist_pix / dt     # px/s
                        row["foot_speed_right"] = round(foot_speed, 2)

                prev_right_ankle = r_ankle
                prev_time = time_s

                # ---- Taille "corps" pour vitesse normalisée ----
                body_len = np.max(kpts[:, 1]) - np.min(kpts[:, 1])
                if body_len > 0 and not np.isnan(foot_speed):
                    foot_speed_norm = foot_speed / body_len
                    row["foot_speed_norm"] = round(foot_speed_norm, 2)

                # =========================
                #   DESSIN DU SQUELETTE
                # =========================

                LOWER_BODY_IDS = [LSHOULDER, RSHOULDER, LHIP, RHIP,
                                  LKNEE, RKNEE, LANKLE, RANKLE]

                for idx in LOWER_BODY_IDS:
                    x, y = kpts[idx]
                    cv2.circle(annotated, (int(x), int(y)), 5, (0, 255, 0), -1)

                skeleton_edges = [
                    # tronc
                    (LSHOULDER, RSHOULDER),
                    (LSHOULDER, LHIP),
                    (RSHOULDER, RHIP),
                    (LHIP, RHIP),
                    # jambe gauche
                    (LHIP, LKNEE),
                    (LKNEE, LANKLE),
                    # jambe droite
                    (RHIP, RKNEE),
                    (RKNEE, RANKLE),
                ]
                for i, j in skeleton_edges:
                    x1, y1 = kpts[i]
                    x2, y2 = kpts[j]
                    cv2.line(annotated, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)

                # =========================
                #   ANGLES SUR LE COUREUR
                # =========================

                def put_angle(text, pos, color):
                    cv2.putText(
                        annotated, text,
                        (int(pos[0]), int(pos[1])),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
                    )

                knee_color_right = (0, 255, 0) if knee_angle_right >= KNEE_EXTENSION_MIN else (0, 0, 255)
                knee_color_left = (0, 255, 0) if knee_angle_left >= KNEE_EXTENSION_MIN else (0, 0, 255)

                put_angle(f"KR {knee_angle_right:.0f}°", r_knee, knee_color_right)
                put_angle(f"KL {knee_angle_left:.0f}°", l_knee, knee_color_left)
                put_angle(f"HR {hip_angle_right:.0f}°", r_hip, (255, 255, 0))
                put_angle(f"HL {hip_angle_left:.0f}°", l_hip, (255, 255, 0))
                put_angle(f"AR {ankle_angle_right:.0f}°", r_ankle, (255, 0, 255))
                put_angle(f"AL {ankle_angle_left:.0f}°", l_ankle, (255, 0, 255))

                # =========================
                #   HUD EN HAUT À GAUCHE
                # =========================

                hud_x, hud_y = 10, 25
                line_h = 22
                font = cv2.FONT_HERSHEY_SIMPLEX

                # Asymétrie genou
                knee_diff = np.nan
                if not np.isnan(knee_angle_right) and not np.isnan(knee_angle_left):
                    knee_diff = abs(knee_angle_right - knee_angle_left)

                hud_color = (0, 255, 0)
                if knee_diff is not np.nan and knee_diff > ASYM_THRESHOLD:
                    hud_color = (0, 165, 255)  # orange
                if knee_angle_right < 100 or knee_angle_left < 100:
                    hud_color = (0, 0, 255)    # rouge si flexion très forte

                hud_lines = [
                    f"t = {time_s:.2f} s",
                    f"Genou D/G = {knee_angle_right:.0f}° / {knee_angle_left:.0f}°",
                    f"Diff genou = {knee_diff:.1f}°" if knee_diff is not np.nan else "Diff genou = N/A",
                    f"v pied D = {row['foot_speed_right']:.0f} px/s" if not np.isnan(row["foot_speed_right"]) else "v pied D = N/A",
                    f"v pied D ~ {row['foot_speed_norm']:.2f} L/s" if not np.isnan(row["foot_speed_norm"]) else ""
                ]

                overlay = annotated.copy()
                cv2.rectangle(
                    overlay,
                    (hud_x - 5, hud_y - 20),
                    (hud_x + 340, hud_y + line_h * len(hud_lines)),
                    (0, 0, 0), -1
                )
                cv2.addWeighted(overlay, 0.4, annotated, 0.6, 0, annotated)

                for i, txt in enumerate(hud_lines):
                    if txt == "":
                        continue
                    cv2.putText(
                        annotated, txt,
                        (hud_x, hud_y + i * line_h),
                        font, 0.6, hud_color, 2
                    )

            # ---- écriture CSV + vidéo ----
            writer.writerow(row)
            out.write(annotated)

            if frame_idx % 20 == 0:
                print(f"[INFO] Frame {frame_idx}/{frame_count}")

    finally:
        cap.release()
        out.release()
        csv_file.close()

    print("[INFO] Analyse vidéo terminée.")
    print(f"Vidéo annotée : {os.path.abspath(VIDEO_OUTPUT)}")
    print(f"CSV des métriques : {os.path.abspath(CSV_OUTPUT)}")


# =========================
#   2) ANALYSE DU CSV + GRAPHES
# =========================

def analyse_csv():
    os.makedirs(FIG_DIR, exist_ok=True)
    df = pd.read_csv(CSV_OUTPUT)
    df = df.dropna(how="all")

    # colonne d'asymétrie
    df["knee_diff"] = np.abs(df["knee_angle_right"] - df["knee_angle_left"])

    def save_fig(path):
        plt.tight_layout()
        plt.savefig(path, dpi=300)
        plt.close()

    # 1) Angles de genou
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["knee_angle_right"], label="Genou droit")
    plt.plot(df["time_s"], df["knee_angle_left"], "--", label="Genou gauche")
    plt.xlabel("Temps (s)")
    plt.ylabel("Angle du genou (°)")
    plt.title("Évolution de l'angle du genou")
    plt.legend()
    plt.grid(True)
    save_fig(os.path.join(FIG_DIR, "angles_genou.png"))

    # 2) Asymétrie
    plt.figure(figsize=(10, 4))
    plt.plot(df["time_s"], df["knee_diff"])
    plt.axhline(10, color="red", linestyle="--", label="Seuil 10°")
    plt.xlabel("Temps (s)")
    plt.ylabel("Différence (°)")
    plt.title("Asymétrie des genoux (|D - G|)")
    plt.legend()
    plt.grid(True)
    save_fig(os.path.join(FIG_DIR, "asymetrie_genou.png"))

    # 3) Hanche
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["hip_angle_right"], label="Hanche droite")
    plt.plot(df["time_s"], df["hip_angle_left"], "--", label="Hanche gauche")
    plt.xlabel("Temps (s)")
    plt.ylabel("Angle de hanche (°)")
    plt.title("Évolution de l'angle de hanche")
    plt.legend()
    plt.grid(True)
    save_fig(os.path.join(FIG_DIR, "angles_hanche.png"))

    # 4) Cheville
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["ankle_angle_right"], label="Cheville droite")
    plt.plot(df["time_s"], df["ankle_angle_left"], "--", label="Cheville gauche")
    plt.xlabel("Temps (s)")
    plt.ylabel("Angle de cheville (°)")
    plt.title("Évolution de l'angle de cheville")
    plt.legend()
    plt.grid(True)
    save_fig(os.path.join(FIG_DIR, "angles_cheville.png"))

    # 5) Vitesse du pied (px/s)
    plt.figure(figsize=(10, 5))
    plt.plot(df["time_s"], df["foot_speed_right"])
    plt.xlabel("Temps (s)")
    plt.ylabel("Vitesse pied droit (px/s)")
    plt.title("Vitesse de la cheville droite")
    plt.grid(True)
    save_fig(os.path.join(FIG_DIR, "vitesse_pied_px.png"))

    # 6) Vitesse normalisée
    if "foot_speed_norm" in df.columns:
        plt.figure(figsize=(10, 5))
        plt.plot(df["time_s"], df["foot_speed_norm"])
        plt.xlabel("Temps (s)")
        plt.ylabel("Vitesse normalisée (L/s)")
        plt.title("Vitesse pied droit normalisée (longueurs de corps / s)")
        plt.grid(True)
        save_fig(os.path.join(FIG_DIR, "vitesse_pied_norm.png"))

    # Résumé numérique
    def stats_txt(col):
        return f"min={df[col].min():.1f}, max={df[col].max():.1f}, moy={df[col].mean():.1f}"

    print("\n===== RÉSUMÉ BIOMÉCANIQUE (d'après le CSV) =====\n")
    print("Genou droit :", stats_txt("knee_angle_right"))
    print("Genou gauche:", stats_txt("knee_angle_left"))
    print("Asymétrie genoux (|D-G|) :", stats_txt("knee_diff"))
    print("\nHanche droite :", stats_txt("hip_angle_right"))
    print("Hanche gauche :", stats_txt("hip_angle_left"))
    print("\nCheville droite :", stats_txt("ankle_angle_right"))
    print("Cheville gauche :", stats_txt("ankle_angle_left"))
    print("\nVitesse pied droit (px/s) :", stats_txt("foot_speed_right"))
    if "foot_speed_norm" in df.columns:
        print("Vitesse pied droit normalisée (L/s) :", stats_txt("foot_speed_norm"))

    print(f"\nGraphes sauvegardés dans : {os.path.abspath(FIG_DIR)}")


# =========================
#   MAIN
# =========================

if __name__ == "__main__":
    analyse_video()   # 1) vidéo + CSV
    analyse_csv()     # 2) graphs + résumé
