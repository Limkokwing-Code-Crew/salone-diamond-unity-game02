import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  scores: defineTable({
    userId: v.id("users"),
    username: v.string(),
    score: v.number(),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("alltime")),
    achievedAt: v.number(),
  })
    .index("by_period_score", ["period", "score"])
    .index("by_user_period", ["userId", "period"]),
});
