// Auth service that switches between mock and real Cognito
// Import this file instead of cognito.server.ts directly

import type { UserRole } from "~/types/database";

// Check if we're in mock mode (no AWS credentials configured)
const isMockMode = !process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID;

import * as mockAuth from "./mock-auth.server";
import * as cognitoAuth from "./cognito.server";

// Re-export types
export type { UserRole };

export interface CognitoUser {
  username: string;
  role: UserRole;
  email?: string;
  createdAt?: Date;
  enabled: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

// Export functions that dynamically use the correct module
export async function authenticate(username: string, password: string): Promise<AuthResult> {
  if (isMockMode) {
    return mockAuth.authenticate(username, password);
  }
  return cognitoAuth.authenticate(username, password);
}

export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  if (isMockMode) {
    return mockAuth.refreshTokens(refreshToken);
  }
  return cognitoAuth.refreshTokens(refreshToken);
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole = "member",
  email?: string
): Promise<CognitoUser> {
  if (isMockMode) {
    return mockAuth.createUser(username, password, role, email);
  }
  return cognitoAuth.createUser(username, password, role, email);
}

export async function deleteUser(username: string): Promise<void> {
  if (isMockMode) {
    return mockAuth.deleteUser(username);
  }
  return cognitoAuth.deleteUser(username);
}

export async function changePassword(username: string, newPassword: string): Promise<void> {
  if (isMockMode) {
    return mockAuth.changePassword(username, newPassword);
  }
  return cognitoAuth.changePassword(username, newPassword);
}

export async function getUser(username: string): Promise<CognitoUser | null> {
  if (isMockMode) {
    return mockAuth.getUser(username);
  }
  return cognitoAuth.getUser(username);
}

export async function getUserRole(username: string): Promise<UserRole> {
  if (isMockMode) {
    return mockAuth.getUserRole(username);
  }
  return cognitoAuth.getUserRole(username);
}

export async function updateUserRole(username: string, newRole: UserRole): Promise<void> {
  if (isMockMode) {
    return mockAuth.updateUserRole(username, newRole);
  }
  return cognitoAuth.updateUserRole(username, newRole);
}

export async function updateUserEmail(username: string, email: string): Promise<void> {
  if (isMockMode) {
    return mockAuth.updateUserEmail(username, email);
  }
  return cognitoAuth.updateUserEmail(username, email);
}

export async function listUsers(): Promise<CognitoUser[]> {
  if (isMockMode) {
    return mockAuth.listUsers();
  }
  return cognitoAuth.listUsers();
}

export function parseIdToken(idToken: string): {
  username: string;
  email?: string;
  groups?: string[];
} {
  if (isMockMode) {
    return mockAuth.parseIdToken(idToken);
  }
  return cognitoAuth.parseIdToken(idToken);
}

// Export mock mode flag for debugging
export { isMockMode };
