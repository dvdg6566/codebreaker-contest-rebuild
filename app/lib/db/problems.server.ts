/**
 * Problems Database Service
 *
 * Provides CRUD operations for problems.
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 */

import type { Problem, ProblemType } from "~/types/database";
import { DEFAULT_PROBLEM, getMaxScore } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/problems.server")
  : null;

import { mockProblems, getProblemById } from "../mock-data";

// Re-export utility
export { getMaxScore };

/**
 * Get all problems
 */
export async function listProblems(): Promise<Problem[]> {
  if (dynamodb) {
    return dynamodb.listProblems();
  }
  return mockProblems;
}

/**
 * Get validated problems only
 */
export async function listValidatedProblems(): Promise<Problem[]> {
  const problems = await listProblems();
  return problems.filter((p) => p.validated);
}

/**
 * Get a problem by name
 */
export async function getProblem(problemName: string): Promise<Problem | null> {
  if (dynamodb) {
    return dynamodb.getProblem(problemName);
  }
  return getProblemById(problemName);
}

/**
 * Get problems by type
 */
export async function getProblemsByType(
  problemType: ProblemType
): Promise<Problem[]> {
  const problems = await listProblems();
  return problems.filter((p) => p.problem_type === problemType);
}

/**
 * Get problems by difficulty
 */
export async function getProblemsByDifficulty(
  difficulty: "easy" | "medium" | "hard"
): Promise<Problem[]> {
  const problems = await listProblems();
  return problems.filter((p) => p.difficulty === difficulty);
}

/**
 * Get problems by tags
 */
export async function getProblemsByTags(tags: string[]): Promise<Problem[]> {
  const problems = await listProblems();
  return problems.filter((p) =>
    tags.some((tag) => p.tags?.includes(tag))
  );
}

/**
 * Create a new problem
 */
export async function createProblem(
  problemName: string,
  data?: Partial<Problem>
): Promise<Problem> {
  if (dynamodb) {
    return dynamodb.createProblem(problemName, data);
  }
  const newProblem: Problem = {
    ...DEFAULT_PROBLEM,
    problemName,
    title: data?.title || problemName,
    ...data,
  };

  mockProblems.push(newProblem);
  return newProblem;
}

/**
 * Update a problem
 */
export async function updateProblem(
  problemName: string,
  updates: Partial<Problem>
): Promise<Problem | null> {
  // Don't allow changing problemName (primary key)
  const { problemName: _, ...safeUpdates } = updates as Problem & {
    problemName?: string;
  };

  if (dynamodb) {
    return dynamodb.updateProblem(problemName, safeUpdates);
  }

  const index = mockProblems.findIndex((p) => p.problemName === problemName);
  if (index === -1) return null;

  mockProblems[index] = {
    ...mockProblems[index],
    ...safeUpdates,
  };

  return mockProblems[index];
}

/**
 * Delete a problem
 */
export async function deleteProblem(problemName: string): Promise<boolean> {
  if (dynamodb) {
    return dynamodb.deleteProblem(problemName);
  }
  const index = mockProblems.findIndex((p) => p.problemName === problemName);
  if (index === -1) return false;

  mockProblems.splice(index, 1);
  return true;
}

/**
 * Check if problem exists
 */
export async function problemExists(problemName: string): Promise<boolean> {
  const problem = await getProblem(problemName);
  return problem !== null;
}

/**
 * Validate a problem (mark as ready for submissions)
 */
export async function validateProblem(
  problemName: string
): Promise<Problem | null> {
  if (dynamodb) {
    return dynamodb.validateProblem(problemName);
  }
  return updateProblem(problemName, { validated: true });
}

/**
 * Invalidate a problem (mark as not ready for submissions)
 */
export async function invalidateProblem(
  problemName: string
): Promise<Problem | null> {
  if (dynamodb) {
    return dynamodb.invalidateProblem(problemName);
  }
  return updateProblem(problemName, { validated: false });
}

/**
 * Get problems for a list of problem names (for contest problems)
 */
export async function getProblemsForContest(
  problemNames: string[]
): Promise<Problem[]> {
  if (dynamodb) {
    return dynamodb.getProblemsForContest(problemNames);
  }
  return mockProblems.filter((p) => problemNames.includes(p.problemName));
}

/**
 * Update problem subtask configuration
 */
export async function updateSubtasks(
  problemName: string,
  subtaskScores: number[],
  subtaskDependency: string[]
): Promise<Problem | null> {
  return updateProblem(problemName, { subtaskScores, subtaskDependency });
}
