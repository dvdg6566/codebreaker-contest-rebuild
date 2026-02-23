/**
 * Contests Database Service
 *
 * Provides CRUD operations for contests.
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 */

import type { Contest, ContestStatus } from "~/types/database";
import { parseDateTime, isDateTimeNotSet } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

// Conditionally import DynamoDB implementation
const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/contests.server")
  : null;

// Mock data imports
import {
  mockContests,
  getContestStatus as mockGetContestStatus,
  getContestById,
  updateContest as mockUpdateContest,
  createContest as mockCreateContest,
  deleteContest as mockDeleteContest,
} from "../mock-data";

/**
 * Calculate contest status from start/end times
 */
export function getContestStatus(contest: Contest): ContestStatus {
  const now = new Date();
  const startTime = parseDateTime(contest.startTime);
  const endTime = parseDateTime(contest.endTime);

  if (now < startTime) return "NOT_STARTED";
  if (!isDateTimeNotSet(contest.endTime) && now >= endTime) return "ENDED";
  return "ONGOING";
}

/**
 * Get all contests
 */
export async function listContests(): Promise<Contest[]> {
  if (dynamodb) {
    return dynamodb.listContests();
  }
  return mockContests;
}

/**
 * Get all contests with computed status
 */
export async function listContestsWithStatus(): Promise<
  (Contest & { status: ContestStatus })[]
> {
  if (dynamodb) {
    return dynamodb.listContestsWithStatus();
  }
  return mockContests.map((c) => ({
    ...c,
    status: getContestStatus(c),
  }));
}

/**
 * Get a contest by ID
 */
export async function getContest(contestId: string): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.getContest(contestId);
  }
  return getContestById(contestId);
}

/**
 * Get a contest with computed status
 */
export async function getContestWithStatus(
  contestId: string
): Promise<(Contest & { status: ContestStatus }) | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;
  return {
    ...contest,
    status: getContestStatus(contest),
  };
}

/**
 * Get contests by status
 */
export async function getContestsByStatus(
  status: ContestStatus
): Promise<Contest[]> {
  const contests = await listContests();
  return contests.filter((c) => getContestStatus(c) === status);
}

/**
 * Get public contests
 */
export async function getPublicContests(): Promise<Contest[]> {
  const contests = await listContests();
  return contests.filter((c) => c.public);
}

/**
 * Create a new contest
 */
export async function createContest(
  contestId: string,
  data?: Partial<Contest>
): Promise<Contest> {
  if (dynamodb) {
    return dynamodb.createContest(contestId, data);
  }
  const contest = mockCreateContest(contestId);
  if (data) {
    return (await updateContest(contestId, data)) || contest;
  }
  return contest;
}

/**
 * Update a contest
 */
export async function updateContest(
  contestId: string,
  updates: Partial<Contest>
): Promise<Contest | null> {
  // Don't allow changing contestId (primary key)
  const { contestId: _, ...safeUpdates } = updates as Contest & {
    contestId?: string;
  };

  if (dynamodb) {
    return dynamodb.updateContest(contestId, safeUpdates);
  }
  return mockUpdateContest(contestId, safeUpdates);
}

/**
 * Delete a contest
 */
export async function deleteContest(contestId: string): Promise<boolean> {
  if (dynamodb) {
    return dynamodb.deleteContest(contestId);
  }
  return mockDeleteContest(contestId);
}

/**
 * Check if contest exists
 */
export async function contestExists(contestId: string): Promise<boolean> {
  const contest = await getContest(contestId);
  return contest !== null;
}

/**
 * Add a problem to a contest
 */
export async function addProblemToContest(
  contestId: string,
  problemName: string
): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.addProblemToContest(contestId, problemName);
  }
  const contest = getContestById(contestId);
  if (!contest) return null;

  if (!contest.problems.includes(problemName)) {
    contest.problems.push(problemName);
  }

  return contest;
}

/**
 * Remove a problem from a contest
 */
export async function removeProblemFromContest(
  contestId: string,
  problemName: string
): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.removeProblemFromContest(contestId, problemName);
  }
  const contest = getContestById(contestId);
  if (!contest) return null;

  contest.problems = contest.problems.filter((p) => p !== problemName);
  return contest;
}

/**
 * Add a user to a contest
 */
export async function addUserToContest(
  contestId: string,
  username: string,
  started: boolean = false
): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.addUserToContest(contestId, username, started);
  }
  const contest = getContestById(contestId);
  if (!contest) return null;

  if (!contest.users) contest.users = {};
  contest.users[username] = started ? "1" : "0";

  return contest;
}

/**
 * Remove a user from a contest
 */
export async function removeUserFromContest(
  contestId: string,
  username: string
): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.removeUserFromContest(contestId, username);
  }
  const contest = getContestById(contestId);
  if (!contest || !contest.users) return null;

  delete contest.users[username];
  return contest;
}

/**
 * Mark a user as started in a contest
 */
export async function markUserStarted(
  contestId: string,
  username: string
): Promise<Contest | null> {
  return addUserToContest(contestId, username, true);
}

/**
 * Update user's score in a contest
 */
export async function updateContestScore(
  contestId: string,
  username: string,
  problemName: string,
  score: number
): Promise<Contest | null> {
  if (dynamodb) {
    await dynamodb.updateContestScore(contestId, username, problemName, score);
    return dynamodb.getContest(contestId);
  }
  const contest = getContestById(contestId);
  if (!contest) return null;

  if (!contest.scores) contest.scores = {};
  if (!contest.scores[username]) contest.scores[username] = {};

  const currentScore = contest.scores[username][problemName] || 0;
  if (score > currentScore) {
    contest.scores[username][problemName] = score;
  }

  return contest;
}

/**
 * Get the active/ongoing contest
 */
export async function getActiveContest(): Promise<Contest | null> {
  if (dynamodb) {
    return dynamodb.getActiveContest();
  }
  return mockContests.find((c) => getContestStatus(c) === "ONGOING") || null;
}
