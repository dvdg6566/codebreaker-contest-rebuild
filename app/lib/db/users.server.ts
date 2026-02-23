/**
 * Users Database Service
 *
 * Provides CRUD operations for user accounts.
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 */

import type { User, UserRole } from "~/types/database";
import { DEFAULT_USER } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

// Conditionally import the appropriate implementation
const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/users.server")
  : null;

// Mock data (only used in mock mode)
import { mockUsers, type MockUser } from "../mock-data";

/**
 * Get all users
 */
export async function listUsers(): Promise<User[]> {
  if (dynamodb) {
    return dynamodb.listUsers();
  }
  // Strip password from mock users
  return mockUsers.map(({ password, ...user }) => user);
}

/**
 * Get a user by username
 */
export async function getUser(username: string): Promise<User | null> {
  if (dynamodb) {
    return dynamodb.getUser(username);
  }
  const user = mockUsers.find((u) => u.username === username);
  if (!user) return null;
  const { password, ...userData } = user;
  return userData;
}

/**
 * Get a user with password (for authentication - mock only)
 */
export async function getUserWithPassword(
  username: string
): Promise<MockUser | null> {
  // This is only for mock mode authentication
  return mockUsers.find((u) => u.username === username) || null;
}

/**
 * Get users by contest
 */
export async function getUsersByContest(contestId: string): Promise<User[]> {
  if (dynamodb) {
    return dynamodb.listUsersByContest(contestId);
  }
  return mockUsers
    .filter((u) => u.contest === contestId)
    .map(({ password, ...user }) => user);
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  if (dynamodb) {
    const users = await dynamodb.listUsers();
    return users.filter((u) => u.role === role);
  }
  return mockUsers
    .filter((u) => u.role === role)
    .map(({ password, ...user }) => user);
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  role: UserRole,
  password: string,
  data?: Partial<User>
): Promise<User> {
  if (dynamodb) {
    // In DynamoDB mode, password is handled by Cognito, not stored in DynamoDB
    return dynamodb.createUser(username, role, data);
  }

  const newUser: MockUser = {
    ...DEFAULT_USER,
    username,
    role,
    fullname: data?.fullname || username,
    password,
    ...data,
  };

  mockUsers.push(newUser);

  const { password: _, ...userData } = newUser;
  return userData;
}

/**
 * Update a user
 */
export async function updateUser(
  username: string,
  updates: Partial<User>
): Promise<User | null> {
  if (dynamodb) {
    return dynamodb.updateUser(username, updates);
  }

  const index = mockUsers.findIndex((u) => u.username === username);
  if (index === -1) return null;

  // Don't allow changing username (primary key)
  const { username: _, ...safeUpdates } = updates as User & { username?: string };

  mockUsers[index] = {
    ...mockUsers[index],
    ...safeUpdates,
  };

  const { password, ...userData } = mockUsers[index];
  return userData;
}

/**
 * Update user's problem score
 */
export async function updateUserScore(
  username: string,
  problemName: string,
  score: number,
  submissionTime?: string
): Promise<User | null> {
  if (dynamodb) {
    const time = submissionTime || new Date().toISOString().replace("T", " ").slice(0, 19);
    await dynamodb.updateUserScore(username, problemName, score, time);
    return dynamodb.getUser(username);
  }

  const index = mockUsers.findIndex((u) => u.username === username);
  if (index === -1) return null;

  const user = mockUsers[index];
  const currentScore = user.problemScores[problemName] || 0;

  // Only update if new score is higher
  if (score > currentScore) {
    user.problemScores[problemName] = score;
    user.latestScoreChange = new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  const { password, ...userData } = user;
  return userData;
}

/**
 * Delete a user
 */
export async function deleteUser(username: string): Promise<boolean> {
  if (dynamodb) {
    return dynamodb.deleteUser(username);
  }

  const index = mockUsers.findIndex((u) => u.username === username);
  if (index === -1) return false;

  mockUsers.splice(index, 1);
  return true;
}

/**
 * Check if username exists
 */
export async function userExists(username: string): Promise<boolean> {
  if (dynamodb) {
    const user = await dynamodb.getUser(username);
    return user !== null;
  }
  return mockUsers.some((u) => u.username === username);
}

/**
 * Validate user credentials (mock authentication only)
 * In production, use Cognito for authentication
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<User | null> {
  // This should only be used in mock mode
  const user = mockUsers.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return null;

  const { password: _, ...userData } = user;
  return userData;
}
