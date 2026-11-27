// Drizzle schema for KUC – Kalanja United Club.
//
// Tables: players, player_stats, payments, committees, committee_members,
// awards, admin_auth, admin_sessions, activity_log.
// The scaffold `entries` table is dropped by the club migration.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerCode: text("player_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  position: text("position").notNull(),
  phone: text("phone").notNull().default(""),
  joiningDate: text("joining_date").notNull(),
  status: text("status", { enum: ["Active", "Inactive"] })
    .notNull()
    .default("Active"),
  photoBlobKey: text("photo_blob_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playerStats = sqliteTable("player_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id")
    .notNull()
    .unique()
    .references(() => players.id),
  matchesPlayed: integer("matches_played").notNull().default(0),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  yellowCards: integer("yellow_cards").notNull().default(0),
  redCards: integer("red_cards").notNull().default(0),
  performance: real("performance").notNull().default(0),
  attendance: real("attendance").notNull().default(0),
  customStats: text("custom_stats").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  weekStart: text("week_start").notNull(),
  amount: integer("amount").notNull().default(10),
  status: text("status", { enum: ["paid", "unpaid"] })
    .notNull()
    .default("unpaid"),
  paidDate: text("paid_date"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const committees = sqliteTable("committees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const committeeMembers = sqliteTable("committee_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  committeeId: integer("committee_id")
    .notNull()
    .references(() => committees.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  position: text("position").notNull(),
});

export const awards = sqliteTable("awards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  awardType: text("award_type", {
    enum: ["ballon_dor", "golden_boot", "golden_gloves"],
  }).notNull(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  description: text("description").notNull().default(""),
  detailStats: text("detail_stats").notNull().default("{}"),
  published: integer("published").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adminAuth = sqliteTable("admin_auth", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adminSessions = sqliteTable("admin_sessions", {
  token: text("token").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Editor account: a second, narrower login created by the admin. An editor
// session may only edit committees, player statistics and money records.
export const editorAuth = sqliteTable("editor_auth", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const editorSessions = sqliteTable("editor_sessions", {
  token: text("token").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// One-off site bookkeeping flags (e.g. marking a one-time maintenance
// action as used so it can never run twice).
export const siteFlags = sqliteTable("site_flags", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
