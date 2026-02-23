import { redirect } from "react-router";
import { getSession, createSession, destroySession, type SessionData } from "./session.server";
import {
  authenticate,
  getUserRole,
  parseIdToken,
  isMockMode,
  type UserRole,
} from "./auth-service.server";

export type { SessionData, UserRole };

// Log mode on startup
if (isMockMode) {
  console.log("🔧 Running in MOCK MODE - using mock authentication with DynamoDB users");
  console.log("   Login with any DynamoDB user using password: <username>123 or password123");
} else {
  console.log("☁️  Running with AWS Cognito authentication");
}

/**
 * Login user and create session
 */
export async function login(
  username: string,
  password: string
): Promise<{ session: SessionData; cookie: string }> {
  // Authenticate with auth service (mock or Cognito)
  const authResult = await authenticate(username, password);

  // Parse ID token to get user info
  const tokenInfo = parseIdToken(authResult.idToken);

  // Get user role
  const role = await getUserRole(username);

  // Create session data
  const session: SessionData = {
    userId: tokenInfo.username,
    username: tokenInfo.username,
    role,
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    idToken: authResult.idToken,
    expiresAt: Date.now() + authResult.expiresIn * 1000,
  };

  // Create session cookie
  const cookie = await createSession(session);

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
