/**
 * Clarifications Database Service
 *
 * Provides CRUD operations for clarifications (Q&A).
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 *
 * Note: Clarifications use a composite key (askedBy + clarificationTime)
 */

import type { Clarification } from "~/types/database";
import { formatDateTime, getClarificationStatus } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/clarifications.server")
  : null;

import { mockClarifications } from "../mock-data";

// Re-export utility
export { getClarificationStatus };

/**
 * Get all clarifications
 */
export async function listClarifications(): Promise<Clarification[]> {
  if (dynamodb) {
    return dynamodb.listClarifications();
  }
  return mockClarifications;
}

/**
 * Get clarifications ordered by time (newest first)
 */
export async function listClarificationsByTime(): Promise<Clarification[]> {
  if (dynamodb) {
    return dynamodb.listClarifications(); // Already sorted
  }
  return [...mockClarifications].sort((a, b) =>
    b.clarificationTime.localeCompare(a.clarificationTime)
  );
}

/**
 * Get a clarification by its composite key
 */
export async function getClarification(
  askedBy: string,
  clarificationTime: string
): Promise<Clarification | null> {
  if (dynamodb) {
    return dynamodb.getClarification(askedBy, clarificationTime);
  }
  return (
    mockClarifications.find(
      (c) => c.askedBy === askedBy && c.clarificationTime === clarificationTime
    ) || null
  );
}

/**
 * Get clarifications by user
 */
export async function getClarificationsByUser(
  username: string
): Promise<Clarification[]> {
  if (dynamodb) {
    return dynamodb.listClarificationsByUser(username);
  }
  return mockClarifications.filter((c) => c.askedBy === username);
}

/**
 * Get clarifications by problem
 */
export async function getClarificationsByProblem(
  problemName: string
): Promise<Clarification[]> {
  const all = await listClarifications();
  return all.filter((c) => c.problemName === problemName);
}

/**
 * Get pending clarifications (unanswered)
 */
export async function getPendingClarifications(): Promise<Clarification[]> {
  if (dynamodb) {
    return dynamodb.listPendingClarifications();
  }
  return mockClarifications.filter((c) => c.answer === "");
}

/**
 * Get answered clarifications
 */
export async function getAnsweredClarifications(): Promise<Clarification[]> {
  const all = await listClarifications();
  return all.filter((c) => c.answer !== "");
}

/**
 * Create a new clarification (ask a question)
 */
export async function createClarification(
  askedBy: string,
  question: string,
  problemName?: string
): Promise<Clarification> {
  if (dynamodb) {
    return dynamodb.createClarification(askedBy, question, problemName || "");
  }

  const newClarification: Clarification = {
    askedBy,
    clarificationTime: formatDateTime(new Date()),
    problemName: problemName || "",
    question,
    answer: "",
    answeredBy: "",
  };

  mockClarifications.push(newClarification);
  return newClarification;
}

/**
 * Answer a clarification
 */
export async function answerClarification(
  askedBy: string,
  clarificationTime: string,
  answer: string,
  answeredBy: string
): Promise<Clarification | null> {
  if (dynamodb) {
    return dynamodb.answerClarification(askedBy, clarificationTime, answer, answeredBy);
  }

  const clarification = await getClarification(askedBy, clarificationTime);
  if (!clarification) return null;

  clarification.answer = answer;
  clarification.answeredBy = answeredBy;

  return clarification;
}

/**
 * Update a clarification's question (only if not answered)
 */
export async function updateClarificationQuestion(
  askedBy: string,
  clarificationTime: string,
  newQuestion: string
): Promise<Clarification | null> {
  const clarification = await getClarification(askedBy, clarificationTime);
  if (!clarification || clarification.answer !== "") return null;

  // In DynamoDB mode, we'd need to update; for now mock only
  clarification.question = newQuestion;
  return clarification;
}

/**
 * Delete a clarification
 */
export async function deleteClarification(
  askedBy: string,
  clarificationTime: string
): Promise<boolean> {
  if (dynamodb) {
    return dynamodb.deleteClarification(askedBy, clarificationTime);
  }

  const index = mockClarifications.findIndex(
    (c) => c.askedBy === askedBy && c.clarificationTime === clarificationTime
  );
  if (index === -1) return false;

  mockClarifications.splice(index, 1);
  return true;
}

/**
 * Count clarifications by status
 */
export async function countClarificationsByStatus(): Promise<{
  pending: number;
  answered: number;
  total: number;
}> {
  const all = await listClarifications();
  const pending = all.filter((c) => c.answer === "").length;
  const answered = all.filter((c) => c.answer !== "").length;
  return {
    pending,
    answered,
    total: all.length,
  };
}

/**
 * Count clarifications for a user
 */
export async function countUserClarifications(
  username: string
): Promise<{ pending: number; answered: number; total: number }> {
  const userClars = await getClarificationsByUser(username);
  const pending = userClars.filter((c) => c.answer === "").length;
  const answered = userClars.filter((c) => c.answer !== "").length;
  return {
    pending,
    answered,
    total: userClars.length,
  };
}

/**
 * Transform clarification for display (with computed status)
 */
export function formatClarificationForDisplay(clarification: Clarification) {
  return {
    ...clarification,
    status: getClarificationStatus(clarification),
  };
}
