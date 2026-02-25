/**
 * Problems Database Service
 *
 * Provides CRUD operations for problems using DynamoDB.
 */

import type { Problem } from "~/types/database";
import { DEFAULT_PROBLEM, getMaxScore } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
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

/**
 * Validation result for a problem
 */
export interface ProblemValidationResult {
  validated: boolean;
  verdicts: {
    statement: number;
    testdata: number;
    scoring: number;
    checker: number;
    grader: number;
    attachments: number;
    subtasks: number;
  };
  remarks: {
    statement: string;
    testdata: string;
    scoring: string;
    checker: string;
    grader: string;
    attachments: string;
    subtasks: string;
  };
}

/**
 * Invoke the problem-validation Lambda to validate a problem.
 * The Lambda checks all files and updates DynamoDB directly.
 */
export async function validateAndUpdateProblem(
  problemName: string
): Promise<ProblemValidationResult> {
  const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");

  const region = process.env.AWS_REGION || "ap-southeast-1";
  const accountId = process.env.AWS_ACCOUNT_ID || "";
  const judgeName = process.env.JUDGE_NAME || "codebreakercontest01";

  const lambdaClient = new LambdaClient({ region });
  const functionArn = `arn:aws:lambda:${region}:${accountId}:function:${judgeName}-problem-validation`;

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionArn,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ problemName }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Payload));

  return {
    validated: Object.values(result.verdicts).every((v) => v === 1),
    verdicts: result.verdicts,
    remarks: result.remarks,
  };
}

/**
 * Get current validation status from problem record (without re-validating)
 */
export async function getValidationStatus(
  problemName: string
): Promise<ProblemValidationResult | null> {
  const problem = await getProblem(problemName);
  if (!problem) return null;

  const verdicts = problem.verdicts || {
    statement: 0,
    testdata: 0,
    scoring: 0,
    checker: 0,
    grader: 0,
    attachments: 0,
    subtasks: 0,
  };

  const remarks = problem.remarks || {
    statement: "Not validated",
    testdata: "Not validated",
    scoring: "Not validated",
    checker: "Not validated",
    grader: "Not validated",
    attachments: "Not validated",
    subtasks: "Not validated",
  };

  // Compute validated from verdicts, not the database field
  // This ensures consistency even if the database is out of sync
  const validated = Object.values(verdicts).every((v) => v === 1);

  return {
    validated,
    verdicts,
    remarks,
  };
}

// Alias for backwards compatibility
export const validateProblemFiles = getValidationStatus;
