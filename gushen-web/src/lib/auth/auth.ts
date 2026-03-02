/**
 * NextAuth.js Configuration
 *
 * Authentication for GuShen platform via Zitadel OIDC.
 * Primary: ZitadelProvider (direct OIDC/PKCE integration)
 * Fallback: local credentials provider (demo accounts, dev only)
 */

import { NextAuthOptions } from "next-auth";
import ZitadelProvider from "next-auth/providers/zitadel";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

const ZITADEL_ISSUER = process.env.ZITADEL_ISSUER || "https://auth.lurus.cn";

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
 * Extract platform role from Zitadel profile claims.
 * Zitadel encodes project roles under: urn:zitadel:iam:org:project:roles
 *
 * Subscription tiers (free/standard/premium) are NOT stored in Zitadel roles —
 * they are managed by lurus-identity and must be fetched via the internal API:
 *   GET /internal/v1/accounts/:id/entitlements/lurus-gushen
 * This avoids stale JWT data when a subscription changes within the token lifetime.
 *
 * This function only surfaces platform-level access roles (admin, ops).
 * All callers receive "free" for subscription-tier decisions; entitlement
 * checks must call lurus-identity directly.
 */
function extractZitadelRole(
  _profile: Record<string, unknown> | undefined,
): "free" | "standard" | "premium" {
  // Subscription tier is not derived from JWT — always return "free" here.
  // Use lurus-identity GET /internal/v1/accounts/:id/entitlements/lurus-gushen
  // to determine the actual entitlement level at the API route layer.
  return "free";
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Zitadel OIDC — direct OIDC integration, PKCE if no client secret
    ZitadelProvider({
      issuer: ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID!,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET ?? "",
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
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase(),
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
    async jwt({ token, user, account, profile }) {
      // Initial sign-in: populate token from user and provider profile
      if (user && account) {
        token.id = user.id;
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;

        if (account.provider === "zitadel") {
          // Map Zitadel profile fields: sub, email, name, preferred_username
          const zitadelProfile = profile as Record<string, unknown> | undefined;
          token.sub = (zitadelProfile?.sub as string | undefined) ?? user.id;
          token.role = extractZitadelRole(zitadelProfile);
        } else {
          // credentials provider
          token.role = (user as { role?: string }).role ?? "free";
        }
      } else if (user) {
        // credentials-only sign-in path
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "free";
        token.email = user.email ?? token.email;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = (token.id ?? token.sub) as string;
        (session.user as { role: string }).role =
          (token.role as string) ?? "free";
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after sign-in unless a specific callbackUrl is given
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
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
    };
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
