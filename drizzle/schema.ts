import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Table des analyses biomécaniques de course à pied
 */
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Métadonnées de la vidéo
  originalVideoKey: varchar("originalVideoKey", { length: 512 }).notNull(),
  originalVideoUrl: varchar("originalVideoUrl", { length: 1024 }).notNull(),
  annotatedVideoKey: varchar("annotatedVideoKey", { length: 512 }),
  annotatedVideoUrl: varchar("annotatedVideoUrl", { length: 1024 }),
  
  // Données CSV et graphiques
  csvDataKey: varchar("csvDataKey", { length: 512 }),
  csvDataUrl: varchar("csvDataUrl", { length: 1024 }),
  
  // Statistiques globales
  duration: float("duration"), // durée en secondes
  frameCount: int("frameCount"),
  fps: float("fps"),
  
  // Métriques moyennes
  avgKneeAngleRight: float("avgKneeAngleRight"),
  avgKneeAngleLeft: float("avgKneeAngleLeft"),
  avgHipAngleRight: float("avgHipAngleRight"),
  avgHipAngleLeft: float("avgHipAngleLeft"),
  avgAnkleAngleRight: float("avgAnkleAngleRight"),
  avgAnkleAngleLeft: float("avgAnkleAngleLeft"),
  avgKneeAsymmetry: float("avgKneeAsymmetry"),
  
  // Métriques min/max
  minKneeAngleRight: float("minKneeAngleRight"),
  maxKneeAngleRight: float("maxKneeAngleRight"),
  minKneeAngleLeft: float("minKneeAngleLeft"),
  maxKneeAngleLeft: float("maxKneeAngleLeft"),
  
  // Statut de traitement
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

/**
 * Table des graphiques générés pour chaque analyse
 */
export const analysisCharts = mysqlTable("analysisCharts", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  
  chartType: varchar("chartType", { length: 64 }).notNull(), // knee_angles, asymmetry, hip_angles, ankle_angles, foot_speed
  chartKey: varchar("chartKey", { length: 512 }).notNull(),
  chartUrl: varchar("chartUrl", { length: 1024 }).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisChart = typeof analysisCharts.$inferSelect;
export type InsertAnalysisChart = typeof analysisCharts.$inferInsert;
