/**
 * NextAuth.js Configuration
 *
 * Authentication configuration for GuShen platform.
 * Supports credentials-based login with future OIDC integration capability.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

// Mock user database - In production, this should be replaced with actual database
// This is a placeholder for development/demo purposes
const DEMO_USERS = [
  {
    id: "1",
    email: "demo@lurus.cn",
    name: "Demo User",
    password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u", // password: demo123
    role: "free", // Subscription tier: free, standard, premium
    avatar: null,
  },
  {
    id: "2",
    email: "admin@lurus.cn",
    name: "Admin User",
    password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u", // password: demo123
    role: "premium",
    avatar: null,
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    // Lurus SSO Provider - Primary authentication method
    CredentialsProvider({
      id: "lurus-sso",
      name: "Lurus SSO",
      credentials: {
        sessionCheck: { label: "Session Check", type: "text" },
      },
      async authorize(credentials, req) {
        const LURUS_API_URL = process.env.LURUS_API_URL || "https://api.lurus.cn";
        const cookies = req.headers?.cookie || "";

        try {
          // Call lurus-api to verify session (with Cookie)
          const response = await fetch(`${LURUS_API_URL}/api/v1/auth/session`, {
            method: "GET",
            credentials: "include",
            headers: {
              "Cookie": cookies,
              "Accept": "application/json",
            },
          });

          if (!response.ok) {
            console.log("Lurus SSO: Session validation failed", response.status);
            return null;
          }

          const sessionData = await response.json();

          if (!sessionData.success || !sessionData.data?.user) {
            console.log("Lurus SSO: Invalid session data structure");
            return null;
          }

          const user = sessionData.data.user;

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.username || user.email,
            lurusUserId: user.id,
            role: "free", // Default role, can be enhanced with actual role from lurus-api
          };
        } catch (error) {
          console.error("Lurus SSO: Error validating session", error);
          return null;
        }
      },
    }),

    // Credentials Provider - Email/Password login (Fallback for local development)
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

        // Find user in mock database
        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
        );

        if (!user) {
          throw new Error("用户不存在");
        }

        // Verify password
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

    // TODO: Stalwart OIDC Provider - Uncomment when Traefik routing is fixed
    // {
    //   id: "stalwart",
    //   name: "Lurus Mail",
    //   type: "oauth",
    //   wellKnown: "https://admin-mail.lurus.cn/.well-known/openid-configuration",
    //   clientId: process.env.STALWART_CLIENT_ID,
    //   clientSecret: process.env.STALWART_CLIENT_SECRET,
    //   authorization: { params: { scope: "openid email profile" } },
    //   idToken: true,
    //   profile(profile) {
    //     return {
    //       id: profile.sub,
    //       name: profile.name || profile.preferred_username,
    //       email: profile.email,
    //       image: null,
    //     };
    //   },
    // },
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "free";
        token.lurusUserId = (user as any).lurusUserId;
        token.email = user.email;
        token.lastRefresh = Date.now();
      }

      // Periodically refresh session from lurus-api (every 30 minutes)
      if (trigger === "update" || !token.lastRefresh) {
        const now = Date.now();
        const lastRefresh = (token.lastRefresh as number) || 0;

        if (now - lastRefresh > 30 * 60 * 1000) {
          const LURUS_API_URL = process.env.LURUS_API_URL || "https://api.lurus.cn";

          try {
            const response = await fetch(`${LURUS_API_URL}/api/v1/auth/session`, {
              credentials: "include",
              headers: {
                "Accept": "application/json",
              },
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.user) {
                token.lurusUserId = data.data.user.id;
                token.email = data.data.user.email;
                token.lastRefresh = now;
              }
            }
          } catch (err) {
            console.error("Failed to refresh session from lurus-api:", err);
          }
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

  // Security settings
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
