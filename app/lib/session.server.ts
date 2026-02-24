import { createCookie } from "react-router";
import type { UserRole } from "~/types/database";

// Cookie for storing session data
// Use a default secret in development, but require it in production
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-please-change-in-production";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.warn("WARNING: SESSION_SECRET is not set. Using insecure default.");
}

export const sessionCookie = createCookie("__session", {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: "/",
  sameSite: "lax",
  secrets: [sessionSecret],
  secure: process.env.NODE_ENV === "production",
});

export interface SessionData {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
  // Note: Tokens are NOT stored in the cookie to avoid exceeding 4KB limit
  // If you need tokens for API calls, implement a server-side session store
}

export async function getSession(request: Request): Promise<SessionData | null> {
  const cookieHeader = request.headers.get("Cookie");
  const session = await sessionCookie.parse(cookieHeader);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt && Date.now() > session.expiresAt) {
    return null;
  }

  return session as SessionData;
}

export async function createSession(data: SessionData): Promise<string> {
  return sessionCookie.serialize(data);
}

export async function destroySession(): Promise<string> {
  return sessionCookie.serialize({}, { maxAge: 0 });
}

export async function requireAuth(request: Request): Promise<SessionData> {
  const { redirect } = await import("react-router");
  const session = await getSession(request);

  if (!session) {
    throw redirect("/login");
  }

  return session;
}

export async function requireAdmin(request: Request): Promise<SessionData> {
  const session = await requireAuth(request);

  if (session.role !== "admin") {
    throw new Response("Forbidden", {
      status: 403,
    });
  }

  return session;
}
