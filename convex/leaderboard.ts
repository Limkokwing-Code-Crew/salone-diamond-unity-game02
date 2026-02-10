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

export const getCurrentPlayers = query({
  args: {},
  handler: async (ctx) => {
    // 1. Get the latest 50 sessions
    const sessions = await ctx.db
      .query("sessions")
      .order("desc")
      .take(50);

    if (sessions.length === 0) return [];

    // 2. Get unique user IDs from these sessions
    const userIds = Array.from(new Set(sessions.map(s => s.userId)));

    // 3. For each user, get their identity and best score
    const players = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        if (!user) return null;

        // Fetch just the single best score for this user
        const bestScore = await ctx.db
          .query("scores")
          .withIndex("by_user_period", (q) => q.eq("userId", userId).eq("period", "alltime"))
          .order("desc")
          .first();

        // Get their latest session timestamp for this group
        const latestSession = sessions.find(s => s.userId === userId);

        return {
          username: user.username,
          score: bestScore ? bestScore.score : 0,
          activeAt: latestSession ? latestSession.createdAt : 0,
        };
      })
    );

    // 4. Filter nulls and sort by score
    return players
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.score - a.score);
  },
});

export const getGlobalHighScore = query({
  args: {},
  handler: async (ctx) => {
    const topScore = await ctx.db
      .query("scores")
      .withIndex("by_period_score", (q) => q.eq("period", "alltime"))
      .order("desc")
      .first();

    if (!topScore) return null;

    return {
      username: topScore.username,
      score: topScore.score,
    };
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
