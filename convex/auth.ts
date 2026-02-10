import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const signup = mutation({
  args: { username: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim();
    const normalizedEmail = args.email.trim().toLowerCase();

    if (username.length < 2) {
      throw new Error("Username must be at least 2 characters");
    }
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (existingUser) {
      throw new Error("Email already exists");
    }

    const passwordHash = await hashPassword(args.password);

    const userId = await ctx.db.insert("users", {
      username,
      email: normalizedEmail,
      passwordHash,
      createdAt: Date.now(),
    });

    const now = Date.now();
    const sessionToken = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      createdAt: now,
      lastSeenAt: now,
    });

    return {
      success: true,
      sessionToken,
      user: {
        _id: userId,
        username,
        email: normalizedEmail,
      },
    };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    const passwordHash = await hashPassword(args.password);
    if (!user || user.passwordHash !== passwordHash) {
      throw new Error("Invalid credentials");
    }

    const now = Date.now();
    const sessionToken = generateToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      createdAt: now,
      lastSeenAt: now,
    });

    return {
      success: true,
      sessionToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    };
  },
});

export const getSessionUser = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    if (!session) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
    };
  },
});

export const touchSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    if (!session) {
      return { ok: false };
    }

    await ctx.db.patch(session._id, { lastSeenAt: Date.now() });
    return { ok: true };
  },
});
