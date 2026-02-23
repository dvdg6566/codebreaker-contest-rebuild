/**
 * Database Service Layer - Entry Point
 *
 * This module provides a unified interface for database operations.
 * It switches between mock data (development) and DynamoDB (production)
 * based on the USE_DYNAMODB environment variable.
 *
 * Usage:
 *   import * as db from "~/lib/db/index.server";
 *   const users = await db.listUsers();
 */

// Environment check for DynamoDB vs Mock mode
const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

// Export the mode flag for debugging/logging
export const isDynamoDBMode = USE_DYNAMODB;

/**
 * Database configuration
 */
export interface DatabaseConfig {
  judgeName: string;
  region: string;
  useDynamoDB: boolean;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
    region: process.env.AWS_REGION || "ap-southeast-1",
    useDynamoDB: USE_DYNAMODB,
  };
}

// Conditionally export based on mode
// In DynamoDB mode, we use real AWS services
// In mock mode, we use in-memory data

if (USE_DYNAMODB) {
  console.log("[DB] Using DynamoDB mode");
} else {
  console.log("[DB] Using mock data mode");
}

// ============================================================================
// Users
// ============================================================================
export {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from "./users.server";

// ============================================================================
// Contests
// ============================================================================
export {
  listContests,
  listContestsWithStatus,
  getContest,
  createContest,
  updateContest,
  deleteContest,
  addProblemToContest,
  addUserToContest,
  getContestStatus,
} from "./contests.server";

// ============================================================================
// Problems
// ============================================================================
export {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  validateProblem,
  getProblemsForContest,
} from "./problems.server";

// ============================================================================
// Submissions
// ============================================================================
export {
  listSubmissions,
  getSubmission,
  createSubmission,
  formatSubmissionForDisplay,
} from "./submissions.server";

// ============================================================================
// Announcements
// ============================================================================
export {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "./announcements.server";

// ============================================================================
// Clarifications
// ============================================================================
export {
  listClarifications,
  getClarification,
  createClarification,
  answerClarification,
} from "./clarifications.server";
