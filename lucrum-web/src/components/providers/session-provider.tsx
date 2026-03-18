"use client";

/**
 * Session Provider Component
 *
 * Wraps the application with NextAuth SessionProvider for client-side session access.
 */

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AuthSessionProvider({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}
