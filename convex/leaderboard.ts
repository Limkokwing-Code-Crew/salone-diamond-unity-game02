import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const periodValidator = v.union(v.literal("daily"), v.literal("weekly"), v.literal("alltime"));

export const getTopScores = query({
  args: { period: periodValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scores")
      .withIndex("by_period_score", (q) => q.eq("period", args.period))
      .order("desc")
      .take(10);
  },
});

export const submit = mutation({
  args: {
    sessionToken: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.score) || args.score < 0) {
      throw new Error("Invalid score");
    }

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    if (!session) {
      throw new Error("Invalid session");
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    await Promise.all([
      ctx.db.insert("scores", {
        userId: user._id,
        username: user.username,
        score: args.score,
        period: "alltime",
        achievedAt: now,
      }),
      ctx.db.insert("scores", {
        userId: user._id,
        username: user.username,
        score: args.score,
        period: "weekly",
        achievedAt: now,
      }),
      ctx.db.insert("scores", {
        userId: user._id,
        username: user.username,
        score: args.score,
        period: "daily",
        achievedAt: now,
      }),
    ]);

    return { success: true };
  },
});
