// Mock authentication for development without AWS Cognito
// Uses DynamoDB for user data, but handles passwords locally for dev mode
import type { UserRole } from "~/types/database";
import {
  getUser as dbGetUser,
  listUsers as dbListUsers,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  deleteUser as dbDeleteUser,
} from "./db/users.server";

// Re-export UserRole for backwards compatibility
export type { UserRole };

// Default password for mock authentication
// In development, all users can log in with this password or their username + "123"
const DEFAULT_PASSWORD = "password123";

export interface MockAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface MockCognitoUser {
  username: string;
  role: UserRole;
  email?: string;
  createdAt?: Date;
  enabled: boolean;
}

// Simple token generation for mock purposes
function generateMockToken(username: string, role: UserRole, email?: string): string {
  const payload = {
    sub: username,
    "cognito:username": username,
    "cognito:groups": [role],
    email: email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Check if password is valid for mock authentication
 * Accepts: default password, or username + "123"
 */
function isValidMockPassword(username: string, password: string): boolean {
  return password === DEFAULT_PASSWORD || password === `${username}123`;
}

/**
 * Mock authenticate - validates against DynamoDB users with simple password check
 */
export async function authenticate(
  username: string,
  password: string
): Promise<MockAuthResult> {
  // Check if user exists in DynamoDB
  const user = await dbGetUser(username);

  if (!user) {
    throw new Error("Invalid username or password");
  }

  // Validate password (simple check for dev mode)
  if (!isValidMockPassword(username, password)) {
    throw new Error("Invalid username or password");
  }

  const token = generateMockToken(username, user.role, user.email);

  return {
    accessToken: `mock-access-${token}`,
    refreshToken: `mock-refresh-${token}`,
    idToken: `mock-id-${token}`,
    expiresIn: 3600,
  };
}

/**
 * Mock refresh tokens
 */
export async function refreshTokens(refreshToken: string): Promise<MockAuthResult> {
  // Extract username from token
  const tokenData = refreshToken.replace("mock-refresh-", "");
  try {
    const payload = JSON.parse(Buffer.from(tokenData, "base64").toString());
    const user = await dbGetUser(payload.sub);
    if (!user) throw new Error("Invalid token");

    const newToken = generateMockToken(user.username, user.role, user.email);
    return {
      accessToken: `mock-access-${newToken}`,
      refreshToken: refreshToken,
      idToken: `mock-id-${newToken}`,
      expiresIn: 3600,
    };
  } catch {
    throw new Error("Token refresh failed");
  }
}

/**
 * Mock create user - creates in DynamoDB
 */
export async function createUser(
  username: string,
  password: string,
  role: UserRole = "member",
  email?: string
): Promise<MockCognitoUser> {
  // Check if user already exists
  const existing = await dbGetUser(username);
  if (existing) {
    throw new Error("User already exists");
  }

  // Create user in DynamoDB (password not stored - Cognito handles this in prod)
  await dbCreateUser(username, role, {
    fullname: username,
    email: email || "",
    label: "",
    contest: "",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  });

  return {
    username,
    role,
    email,
    enabled: true,
    createdAt: new Date(),
  };
}

/**
 * Mock delete user - deletes from DynamoDB
 */
export async function deleteUser(username: string): Promise<void> {
  const user = await dbGetUser(username);
  if (!user) {
    throw new Error("User not found");
  }

  await dbDeleteUser(username);
}

/**
 * Mock change password - no-op in mock mode (passwords aren't stored in DynamoDB)
 */
export async function changePassword(
  username: string,
  newPassword: string
): Promise<void> {
  const user = await dbGetUser(username);
  if (!user) {
    throw new Error("User not found");
  }
  // No-op: passwords aren't stored in DynamoDB, Cognito handles this
  console.log(`[Mock Auth] Password change requested for ${username} - no-op in mock mode`);
}

/**
 * Mock get user - from DynamoDB
 */
export async function getUser(username: string): Promise<MockCognitoUser | null> {
  const user = await dbGetUser(username);
  if (!user) return null;

  return {
    username: user.username,
    role: user.role,
    email: user.email,
    enabled: true,
    createdAt: new Date(),
  };
}

/**
 * Mock get user role - from DynamoDB
 */
export async function getUserRole(username: string): Promise<UserRole> {
  const user = await dbGetUser(username);
  return user?.role || "member";
}

/**
 * Mock update user role - in DynamoDB
 */
export async function updateUserRole(
  username: string,
  newRole: UserRole
): Promise<void> {
  const user = await dbGetUser(username);
  if (!user) {
    throw new Error("User not found");
  }
  await dbUpdateUser(username, { role: newRole });
}

/**
 * Mock update user email - in DynamoDB
 */
export async function updateUserEmail(
  username: string,
  email: string
): Promise<void> {
  const user = await dbGetUser(username);
  if (!user) {
    throw new Error("User not found");
  }
  await dbUpdateUser(username, { email });
}

/**
 * Mock list users - from DynamoDB
 */
export async function listUsers(): Promise<MockCognitoUser[]> {
  const users = await dbListUsers();

  return users.map((u) => ({
    username: u.username,
    role: u.role,
    email: u.email,
    enabled: true,
    createdAt: new Date(),
  }));
}

/**
 * Parse mock ID token
 */
export function parseIdToken(idToken: string): {
  username: string;
  email?: string;
  groups?: string[];
} {
  try {
    const tokenData = idToken.replace("mock-id-", "");
    const payload = JSON.parse(Buffer.from(tokenData, "base64").toString());
    return {
      username: payload["cognito:username"] || payload.sub,
      email: payload.email,
      groups: payload["cognito:groups"] || [],
    };
  } catch {
    throw new Error("Invalid ID token");
  }
}
