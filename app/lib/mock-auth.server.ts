// Mock authentication for development without AWS
import type { UserRole } from "~/types/database";
import { mockUsers, type MockUser } from "./mock-data";

// Re-export UserRole for backwards compatibility
export type { UserRole };

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
function generateMockToken(username: string, role: UserRole): string {
  const payload = {
    sub: username,
    "cognito:username": username,
    "cognito:groups": [role],
    email: mockUsers.find((u) => u.username === username)?.email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Mock authenticate - validates against mock users
 */
export async function authenticate(
  username: string,
  password: string
): Promise<MockAuthResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const user = mockUsers.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    throw new Error("Invalid username or password");
  }

  const token = generateMockToken(username, user.role);

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
    const user = mockUsers.find((u) => u.username === payload.sub);
    if (!user) throw new Error("Invalid token");

    const newToken = generateMockToken(user.username, user.role);
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
 * Mock create user
 */
export async function createUser(
  username: string,
  password: string,
  role: UserRole = "member",
  email?: string
): Promise<MockCognitoUser> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check if user already exists
  if (mockUsers.find((u) => u.username === username)) {
    throw new Error("User already exists");
  }

  // Add to mock users (note: this won't persist across restarts)
  mockUsers.push({
    username,
    password,
    role,
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
 * Mock delete user
 */
export async function deleteUser(username: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const index = mockUsers.findIndex((u) => u.username === username);
  if (index === -1) {
    throw new Error("User not found");
  }

  mockUsers.splice(index, 1);
}

/**
 * Mock change password
 */
export async function changePassword(
  username: string,
  newPassword: string
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const user = mockUsers.find((u) => u.username === username);
  if (!user) {
    throw new Error("User not found");
  }

  user.password = newPassword;
}

/**
 * Mock get user
 */
export async function getUser(username: string): Promise<MockCognitoUser | null> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const user = mockUsers.find((u) => u.username === username);
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
 * Mock get user role
 */
export async function getUserRole(username: string): Promise<UserRole> {
  const user = mockUsers.find((u) => u.username === username);
  return user?.role || "member";
}

/**
 * Mock update user role
 */
export async function updateUserRole(
  username: string,
  newRole: UserRole
): Promise<void> {
  const user = mockUsers.find((u) => u.username === username);
  if (!user) {
    throw new Error("User not found");
  }
  user.role = newRole;
}

/**
 * Mock update user email
 */
export async function updateUserEmail(
  username: string,
  email: string
): Promise<void> {
  const user = mockUsers.find((u) => u.username === username);
  if (!user) {
    throw new Error("User not found");
  }
  user.email = email;
}

/**
 * Mock list users
 */
export async function listUsers(): Promise<MockCognitoUser[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  return mockUsers.map((u) => ({
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
