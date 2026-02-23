/**
 * Problems Database Service
 *
 * Provides CRUD operations for problems using DynamoDB.
 */

import type { Problem, ProblemType } from "~/types/database";
import { DEFAULT_PROBLEM, getMaxScore } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "./dynamodb-client.server";

// Re-export utility
export { getMaxScore };

/**
 * Get all problems
 */
export async function listProblems(): Promise<Problem[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.problems,
    })
  );
  return (result.Items || []) as Problem[];
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
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.problems,
      Key: { problemName },
    })
  );
  return (result.Item as Problem) || null;
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
  const problem: Problem = {
    ...DEFAULT_PROBLEM,
    ...data,
    problemName,
    title: data?.title || problemName,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.problems,
      Item: problem,
      ConditionExpression: "attribute_not_exists(problemName)",
    })
  );

  return problem;
}

/**
 * Update a problem
 */
export async function updateProblem(
  problemName: string,
  updates: Partial<Omit<Problem, "problemName">>
): Promise<Problem | null> {
  const updateParts: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateParts.push(`${attrName} = ${attrValue}`);
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
    }
  });

  if (updateParts.length === 0) {
    return getProblem(problemName);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.problems,
      Key: { problemName },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Problem) || null;
}

/**
 * Delete a problem
 */
export async function deleteProblem(problemName: string): Promise<boolean> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.problems,
      Key: { problemName },
    })
  );
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
  return updateProblem(problemName, { validated: true });
}

/**
 * Invalidate a problem (mark as not ready for submissions)
 */
export async function invalidateProblem(
  problemName: string
): Promise<Problem | null> {
  return updateProblem(problemName, { validated: false });
}

/**
 * Get problems for a list of problem names (for contest problems)
 */
export async function getProblemsForContest(
  problemNames: string[]
): Promise<Problem[]> {
  if (problemNames.length === 0) return [];

  const problems: Problem[] = [];
  for (const problemName of problemNames) {
    const problem = await getProblem(problemName);
    if (problem) problems.push(problem);
  }

  // Return in the same order as the input
  return problemNames
    .map((name) => problems.find((p) => p.problemName === name))
    .filter((p): p is Problem => p !== undefined);
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
