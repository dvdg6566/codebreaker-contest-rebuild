/**
 * Submissions Database Service
 *
 * Provides CRUD operations for submissions.
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 */

import type { Submission, SubmissionVerdict } from "~/types/database";
import { getSubmissionVerdict, formatDateTime } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/submissions.server")
  : null;

import {
  mockSubmissions,
  getSubmissionById,
  createSubmission as mockCreateSubmission,
  getSubmissionsForUser,
  getProblemById,
} from "../mock-data";

// Re-export utility
export { getSubmissionVerdict };

/**
 * Get all submissions
 */
export async function listSubmissions(limit = 100): Promise<Submission[]> {
  if (dynamodb) {
    return dynamodb.listSubmissions(limit);
  }
  return mockSubmissions;
}

/**
 * Get submissions ordered by time (newest first)
 */
export async function listSubmissionsByTime(
  limit?: number
): Promise<Submission[]> {
  if (dynamodb) {
    return dynamodb.listSubmissions(limit || 100);
  }
  const sorted = [...mockSubmissions].sort((a, b) =>
    b.submissionTime.localeCompare(a.submissionTime)
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get a submission by ID
 */
export async function getSubmission(subId: number): Promise<Submission | null> {
  if (dynamodb) {
    return dynamodb.getSubmission(subId);
  }
  return getSubmissionById(subId);
}

/**
 * Get submissions by username
 */
export async function getSubmissionsByUser(
  username: string
): Promise<Submission[]> {
  if (dynamodb) {
    return dynamodb.listSubmissionsByUser(username);
  }
  return getSubmissionsForUser(username);
}

/**
 * Get submissions by problem
 */
export async function getSubmissionsByProblem(
  problemName: string
): Promise<Submission[]> {
  if (dynamodb) {
    return dynamodb.listSubmissionsByProblem(problemName);
  }
  return mockSubmissions.filter((s) => s.problemName === problemName);
}

/**
 * Get submissions by username and problem
 */
export async function getSubmissionsByUserAndProblem(
  username: string,
  problemName: string
): Promise<Submission[]> {
  if (dynamodb) {
    const subs = await dynamodb.listSubmissionsByUser(username);
    return subs.filter((s) => s.problemName === problemName);
  }
  return mockSubmissions.filter(
    (s) => s.username === username && s.problemName === problemName
  );
}

/**
 * Get pending submissions (still being graded)
 */
export async function getPendingSubmissions(): Promise<Submission[]> {
  const submissions = await listSubmissions();
  return submissions.filter((s) => s.status.some((st) => st === 1));
}

/**
 * Create a new submission
 */
export async function createSubmission(
  username: string,
  problemName: string,
  language: string,
  testcaseCount?: number
): Promise<Submission> {
  if (dynamodb) {
    const problem = getProblemById(problemName);
    const count = testcaseCount || problem?.testcaseCount || 10;
    return dynamodb.createSubmission(username, problemName, language, count);
  }
  return mockCreateSubmission(username, problemName, language);
}

/**
 * Update a submission's grading results
 */
export async function updateSubmissionGrading(
  subId: number,
  testcaseIndex: number,
  result: {
    score: number;
    verdict: string;
    time: number;
    memory: number;
    returnCode: number;
  }
): Promise<Submission | null> {
  if (dynamodb) {
    await dynamodb.updateSubmissionTestcase(subId, testcaseIndex, result);
    return dynamodb.getSubmission(subId);
  }

  const submission = getSubmissionById(subId);
  if (!submission) return null;

  // Update testcase result
  submission.score[testcaseIndex] = result.score;
  submission.verdicts[testcaseIndex] = result.verdict;
  submission.times[testcaseIndex] = result.time;
  submission.memories[testcaseIndex] = result.memory;
  submission.returnCodes[testcaseIndex] = result.returnCode;
  submission.status[testcaseIndex] = 2; // completed

  // Update max time/memory
  submission.maxTime = Math.max(submission.maxTime, result.time);
  submission.maxMemory = Math.max(submission.maxMemory, result.memory);

  // Recalculate total score (sum of all testcase scores)
  submission.totalScore = submission.score.reduce((sum, s) => sum + s, 0);

  // Check if all testcases are graded
  if (submission.status.every((s) => s === 2)) {
    submission.gradingCompleteTime = formatDateTime(new Date());
  }

  return submission;
}

/**
 * Mark submission as grading started
 */
export async function markGradingStarted(
  subId: number
): Promise<Submission | null> {
  const submission = await getSubmission(subId);
  if (!submission) return null;

  if (!dynamodb) {
    submission.gradingTime = formatDateTime(new Date());
  }
  return submission;
}

/**
 * Mark submission as compile error
 */
export async function markCompileError(
  subId: number,
  message: string
): Promise<Submission | null> {
  if (dynamodb) {
    return dynamodb.setCompileError(subId, message);
  }

  const submission = getSubmissionById(subId);
  if (!submission) return null;

  submission.compileErrorMessage = message;
  submission.gradingCompleteTime = formatDateTime(new Date());
  submission.verdicts = submission.verdicts.map(() => "CE");
  submission.status = submission.status.map(() => 2);

  return submission;
}

/**
 * Get best submission for a user on a problem
 */
export async function getBestSubmission(
  username: string,
  problemName: string
): Promise<Submission | null> {
  const submissions = await getSubmissionsByUserAndProblem(username, problemName);
  const completed = submissions.filter((s) => s.status.every((st) => st === 2));

  if (completed.length === 0) return null;

  // Return the one with highest score (or earliest if tied)
  return completed.reduce((best, curr) =>
    curr.totalScore > best.totalScore
      ? curr
      : curr.totalScore === best.totalScore &&
        curr.submissionTime < best.submissionTime
      ? curr
      : best
  );
}

/**
 * Count submissions for a user on a problem
 */
export async function countSubmissions(
  username: string,
  problemName: string
): Promise<number> {
  if (dynamodb) {
    return dynamodb.getSubmissionCount(username, problemName);
  }
  return mockSubmissions.filter(
    (s) => s.username === username && s.problemName === problemName
  ).length;
}

/**
 * Get the latest submission time for a user on a problem
 */
export async function getLatestSubmissionTime(
  username: string,
  problemName: string
): Promise<string | null> {
  if (dynamodb) {
    const latest = await dynamodb.getLatestSubmission(username, problemName);
    return latest?.submissionTime || null;
  }
  const submissions = mockSubmissions.filter(
    (s) => s.username === username && s.problemName === problemName
  );

  if (submissions.length === 0) return null;

  return submissions.reduce((latest, curr) =>
    curr.submissionTime > latest.submissionTime ? curr : latest
  ).submissionTime;
}

/**
 * Check if user can submit (respects subDelay)
 */
export async function canUserSubmit(
  username: string,
  problemName: string,
  subDelay: number
): Promise<{ allowed: boolean; waitSeconds: number }> {
  const latest = await getLatestSubmissionTime(username, problemName);
  if (!latest) {
    return { allowed: true, waitSeconds: 0 };
  }

  const latestTime = new Date(latest.replace(" ", "T") + "Z");
  const now = new Date();
  const elapsed = (now.getTime() - latestTime.getTime()) / 1000;

  if (elapsed >= subDelay) {
    return { allowed: true, waitSeconds: 0 };
  }

  return {
    allowed: false,
    waitSeconds: Math.ceil(subDelay - elapsed),
  };
}

/**
 * Transform submission for display (with computed fields)
 */
export function formatSubmissionForDisplay(submission: Submission) {
  const problem = getProblemById(submission.problemName);
  const maxScore = problem
    ? problem.subtaskScores.reduce((sum, s) => sum + s, 0)
    : 100;

  return {
    subId: submission.subId,
    username: submission.username,
    problemName: submission.problemName,
    problemTitle: problem?.title || submission.problemName,
    language: submission.language,
    languageDisplay:
      submission.language === "cpp"
        ? "C++ 17"
        : submission.language === "py"
        ? "Python 3"
        : submission.language === "java"
        ? "Java"
        : submission.language,
    verdict: getSubmissionVerdict(submission),
    score: submission.totalScore,
    maxScore,
    time:
      submission.maxTime > 0
        ? (submission.maxTime / 1000).toFixed(2)
        : "N/A",
    memory:
      submission.maxMemory > 0
        ? (submission.maxMemory / 1000).toFixed(1)
        : "N/A",
    submissionTime: submission.submissionTime,
    isGrading: submission.status.some((s) => s === 1),
  };
}
