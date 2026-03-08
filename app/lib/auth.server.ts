import { redirect } from "react-router";
import { getSession, createSession, destroySession, type SessionData } from "./session.server";
import { randomBytes } from "crypto";
import {
  authenticate,
  getUserRole,
  parseIdToken,
  type UserRole,
} from "./auth-service.server";

export type { SessionData, UserRole };

/**
 * Login user and create session
 */
export async function login(
  username: string,
  password: string,
  rememberMe = false
): Promise<{ session: SessionData; cookie: string }> {
  // Authenticate with auth service (mock or Cognito)
  const authResult = await authenticate(username, password);

  // Parse ID token to get user info
  const tokenInfo = parseIdToken(authResult.idToken);

  // Get user role
  const role = await getUserRole(username);

  // Calculate session duration in milliseconds
  const sessionDurationMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000; // 7 days or 6 hours
  const expiresAt = Date.now() + sessionDurationMs;

  // SECURITY FIX 1: Generate unique session ID to prevent session fixation
  const sessionId = randomBytes(32).toString('hex');

  // Create session data (minimal - tokens excluded to stay under 4KB cookie limit)
  const session: SessionData = {
    sessionId, // Unique session identifier
    userId: tokenInfo.username,
    username: tokenInfo.username,
    role,
    expiresAt,
  };

  // SECURITY FIX 2: Create session cookie with matching maxAge (in seconds)
  const cookie = await createSession(session, Math.floor(sessionDurationMs / 1000));

  return { session, cookie };
}

/**
 * Logout user and destroy session
 */
export async function logout(): Promise<string> {
  return destroySession();
}

/**
 * Require authentication, redirect to login if not authenticated
 */
export async function requireAuth(request: Request): Promise<SessionData> {
  const session = await getSession(request);

  if (!session) {
    throw redirect("/login");
  }

  return session;
}

/**
 * Require admin role, redirect to login or show forbidden
 */
export async function requireAdmin(request: Request): Promise<SessionData> {
  const session = await requireAuth(request);

  if (session.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }

  return session;
}

/**
 * Get current user if authenticated, or null
 */
export async function getCurrentUser(request: Request): Promise<SessionData | null> {
  return getSession(request);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session !== null;
}
