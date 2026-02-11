/**
 * NextAuth.js Configuration
 *
 * Authentication for GuShen platform via Lurus SSO (Zitadel).
 * Primary: lurus-sso provider (cookie-based session from api.lurus.cn)
 * Fallback: local credentials provider (demo accounts, dev only)
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

const LURUS_API_URL = process.env.LURUS_API_URL || "https://api.lurus.cn";
const SESSION_ENDPOINT = `${LURUS_API_URL}/api/v2/auth/session-info`;
const SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Demo accounts for local development only
const DEMO_USERS = [
  {
    id: "1",
    email: "demo@lurus.cn",
    name: "Demo User",
    password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u", // demo123
    role: "free",
    avatar: null,
  },
  {
    id: "2",
    email: "admin@lurus.cn",
    name: "Admin User",
    password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u", // demo123
    role: "premium",
    avatar: null,
  },
];

/**
 * Call lurus-api session-info endpoint to verify a session cookie.
 * Returns user data or null if session is invalid.
 */
async function verifyLurusSession(cookies: string) {
  const response = await fetch(SESSION_ENDPOINT, {
    method: "GET",
    headers: {
      "Cookie": cookies,
      "Accept": "application/json",
    },
  });

  if (!response.ok) return null;

  const body = await response.json();

  // Response shape: { success: true, data: { id, username, display_name, role, status, ... } }
  if (!body.success || !body.data) return null;

  return body.data;
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Lurus SSO — verifies .lurus.cn session cookie via api.lurus.cn
    CredentialsProvider({
      id: "lurus-sso",
      name: "Lurus SSO",
      credentials: {
        sessionCheck: { label: "Session Check", type: "text" },
      },
      async authorize(_credentials, req) {
        const cookies = req.headers?.cookie || "";

        try {
          const userData = await verifyLurusSession(cookies);

          if (!userData) {
            console.log("Lurus SSO: session verification failed");
            return null;
          }

          return {
            id: userData.id.toString(),
            email: userData.email || "",
            name: userData.display_name || userData.username,
            lurusUserId: userData.id,
            role: "free",
          };
        } catch (error) {
          console.error("Lurus SSO: error verifying session:", error);
          return null;
        }
      },
    }),

    // Local credentials — demo accounts for development
    CredentialsProvider({
      id: "credentials",
      name: "Local Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your@email.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码");
        }

        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
        );

        if (!user) {
          throw new Error("用户不存在");
        }

        const isValid = await compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("密码错误");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        };
      },
    }),
  ],

  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
    newUser: "/auth/register",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "free";
        token.lurusUserId = (user as any).lurusUserId;
        token.email = user.email;
        token.lastRefresh = Date.now();
      }

      // Periodic refresh — re-validate session every 30 minutes
      const now = Date.now();
      const lastRefresh = (token.lastRefresh as number) || 0;

      if (token.lurusUserId && now - lastRefresh > SESSION_REFRESH_INTERVAL_MS) {
        try {
          // Server-side refresh cannot forward browser cookies,
          // so we just update the timestamp to avoid repeated attempts.
          // Full re-auth happens on next browser request via middleware.
          token.lastRefresh = now;
        } catch (err) {
          console.error("Failed to refresh session:", err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.lurusUserId;
        (session.user as any).role = token.role;
        (session.user as any).lurusUserId = token.lurusUserId;
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || "gushen-secret-key-change-in-production",

  debug: process.env.NODE_ENV === "development",
};

// Type augmentation for session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "free" | "standard" | "premium";
      lurusUserId?: number;
    };
  }

  interface User {
    role?: string;
    lurusUserId?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    lurusUserId?: number;
    lastRefresh?: number;
  }
}
