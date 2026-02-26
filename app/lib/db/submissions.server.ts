/**
 * Submissions Database Service
 *
 * Provides CRUD operations for submissions using DynamoDB.
 */

import type { Submission, SubmissionVerdict } from "~/types/database";
import { getSubmissionVerdict, formatDateTime } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from "./dynamodb-client.server";
import { incrementCounter } from "./counters.server";
import { getProblem } from "./problems.server";

// Re-export utility
export { getSubmissionVerdict };

/**
 * Get the next submission ID
 */
async function getNextSubmissionId(): Promise<number> {
  return incrementCounter("submissionId");
}

/**
 * Get all submissions (limited)
 */
export async function listSubmissions(limit = 100): Promise<Submission[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.submissions,
      Limit: limit,
    })
  );

  const items = (result.Items || []) as Submission[];
  return items.sort((a, b) => b.subId - a.subId);
}

/**
 * Get submissions ordered by time (newest first)
 */
export async function listSubmissionsByTime(
  limit?: number
): Promise<Submission[]> {
  return listSubmissions(limit || 100);
}

/**
 * Get a submission by ID
 */
export async function getSubmission(subId: number): Promise<Submission | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.submissions,
      Key: { subId },
    })
  );
  return (result.Item as Submission) || null;
}

/**
 * Get submissions by username
 */
export async function getSubmissionsByUser(
  username: string,
  limit = 100
): Promise<Submission[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.submissions,
      IndexName: "usernameIndex",
      KeyConditionExpression: "username = :username",
      ExpressionAttributeValues: {
        ":username": username,
      },
      Limit: limit,
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as Submission[];
}

/**
 * Get submissions by problem
 */
export async function getSubmissionsByProblem(
  problemName: string,
  limit = 100
): Promise<Submission[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.submissions,
      IndexName: "problemIndex",
      KeyConditionExpression: "problemName = :problemName",
      ExpressionAttributeValues: {
        ":problemName": problemName,
      },
      Limit: limit,
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as Submission[];
}

/**
 * Get submissions by username and problem
 */
export async function getSubmissionsByUserAndProblem(
  username: string,
  problemName: string
): Promise<Submission[]> {
  const subs = await getSubmissionsByUser(username);
  return subs.filter((s) => s.problemName === problemName);
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
  const subId = await getNextSubmissionId();
  const now = formatDateTime(new Date());

  const problem = await getProblem(problemName);
  const count = testcaseCount || problem?.testcaseCount || 10;

  const submission: Submission = {
    subId,
    username,
    problemName,
    language,
    submissionTime: now,
    gradingTime: now,
    gradingCompleteTime: "",
    score: Array(count).fill(0),
    verdicts: Array(count).fill(":("),
    times: Array(count).fill(0),
    memories: Array(count).fill(0),
    returnCodes: Array(count).fill(0),
    status: Array(count).fill(1),
    subtaskScores: problem?.subtaskScores?.map(() => 0) || [0],
    totalScore: 0,
    maxTime: 0,
    maxMemory: 0,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.submissions,
      Item: submission,
    })
  );

  return submission;
}

/**
 * Create a new submission with source code upload to S3
 */
export async function createSubmissionWithSource(
  username: string,
  problemName: string,
  language: string,
  sourceCode: string,
  testcaseCount?: number
): Promise<Submission> {
  // Create the submission record first
  const submission = await createSubmission(
    username,
    problemName,
    language,
    testcaseCount
  );

  // Upload source code to S3
  const { uploadSubmissionSource } = await import("../s3.server");
  await uploadSubmissionSource(submission.subId, sourceCode, language);

  return submission;
}

/**
 * Create a Communication problem submission with two source files
 */
export async function createCommunicationSubmission(
  username: string,
  problemName: string,
  language: string,
  sourceCodeA: string,
  sourceCodeB: string,
  testcaseCount?: number
): Promise<Submission> {
  // Create the submission record first
  const submission = await createSubmission(
    username,
    problemName,
    language,
    testcaseCount
  );

  // Upload both source files to S3
  const { uploadCommunicationSource } = await import("../s3.server");
  await uploadCommunicationSource(
    submission.subId,
    sourceCodeA,
    sourceCodeB,
    language
  );

  return submission;
}

/**
 * Update a submission's grading results for a single testcase
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
  await docClient.send(
    new UpdateCommand({
      TableName: TableNames.submissions,
      Key: { subId },
      UpdateExpression: `
        SET score[${testcaseIndex}] = :score,
            verdicts[${testcaseIndex}] = :verdict,
            times[${testcaseIndex}] = :time,
            memories[${testcaseIndex}] = :memory,
            returnCodes[${testcaseIndex}] = :returnCode,
            #status[${testcaseIndex}] = :status
      `,
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":score": result.score,
        ":verdict": result.verdict,
        ":time": result.time,
        ":memory": result.memory,
        ":returnCode": result.returnCode,
        ":status": 2,
      },
    })
  );

  return getSubmission(subId);
}

/**
 * Mark submission as grading started
 */
export async function markGradingStarted(
  subId: number
): Promise<Submission | null> {
  await docClient.send(
    new UpdateCommand({
      TableName: TableNames.submissions,
      Key: { subId },
      UpdateExpression: "SET gradingTime = :gradingTime",
      ExpressionAttributeValues: {
        ":gradingTime": formatDateTime(new Date()),
      },
    })
  );
  return getSubmission(subId);
}

/**
 * Mark submission as compile error
 */
export async function markCompileError(
  subId: number,
  message: string
): Promise<Submission | null> {
  const submission = await getSubmission(subId);
  if (!submission) return null;

  await docClient.send(
    new UpdateCommand({
      TableName: TableNames.submissions,
      Key: { subId },
      UpdateExpression: `
        SET compileErrorMessage = :errorMessage,
            gradingCompleteTime = :gradingCompleteTime
      `,
      ExpressionAttributeValues: {
        ":errorMessage": message,
        ":gradingCompleteTime": formatDateTime(new Date()),
      },
    })
  );

  return getSubmission(subId);
}

/**
 * Complete submission grading
 */
export async function completeSubmissionGrading(
  subId: number,
  subtaskScores: number[],
  totalScore: number,
  maxTime: number,
  maxMemory: number
): Promise<Submission | null> {
  await docClient.send(
    new UpdateCommand({
      TableName: TableNames.submissions,
      Key: { subId },
      UpdateExpression: `
        SET subtaskScores = :subtaskScores,
            totalScore = :totalScore,
            maxTime = :maxTime,
            maxMemory = :maxMemory,
            gradingCompleteTime = :gradingCompleteTime
      `,
      ExpressionAttributeValues: {
        ":subtaskScores": subtaskScores,
        ":totalScore": totalScore,
        ":maxTime": maxTime,
        ":maxMemory": maxMemory,
        ":gradingCompleteTime": formatDateTime(new Date()),
      },
    })
  );

  return getSubmission(subId);
}

/**
 * Get best submission for a user on a problem
 */
export async function getBestSubmission(
  username: string,
  problemName: string
): Promise<Submission | null> {
  const submissions = await getSubmissionsByUserAndProblem(username, problemName);
  const completed = submissions.filter((s) => s.status?.every((st) => st === 2));

  if (completed.length === 0) return null;

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
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.submissions,
      IndexName: "usernameIndex",
      KeyConditionExpression: "username = :username",
      FilterExpression: "problemName = :problemName",
      ExpressionAttributeValues: {
        ":username": username,
        ":problemName": problemName,
      },
      Select: "COUNT",
    })
  );
  return result.Count || 0;
}

/**
 * Get the latest submission time for a user on a problem
 */
export async function getLatestSubmissionTime(
  username: string,
  problemName: string
): Promise<string | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.submissions,
      IndexName: "usernameIndex",
      KeyConditionExpression: "username = :username",
      FilterExpression: "problemName = :problemName",
      ExpressionAttributeValues: {
        ":username": username,
        ":problemName": problemName,
      },
      Limit: 1,
      ScanIndexForward: false,
    })
  );

  const items = result.Items as Submission[] | undefined;
  return items?.[0]?.submissionTime || null;
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
export async function formatSubmissionForDisplay(submission: Submission) {
  const problem = await getProblem(submission.problemName);
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
    isGrading: submission.status?.some((s) => s === 1) ?? true,
  };
}

/**
 * Update scores after grading completion
 * Updates both contest scores (subtask-based) and user scores (total)
 */
export async function updateScoresAfterGrading(
  submission: Submission
): Promise<void> {
  const { updateContestScore, calculateProblemScore } = await import(
    "./contests.server"
  );
  const { updateUserScore } = await import("./users.server");
  const { getUser } = await import("./users.server");

  // Get user to find their contest
  const user = await getUser(submission.username);
  if (!user) return;

  // Calculate total score from subtask scores
  const totalScore = calculateProblemScore(submission.subtaskScores);

  // Update user's problem score (stores total)
  await updateUserScore(
    submission.username,
    submission.problemName,
    totalScore,
    submission.submissionTime
  );

  // Update contest scores (stores subtask bests for IOI-style scoring)
  if (user.contest) {
    await updateContestScore(
      user.contest,
      submission.username,
      submission.problemName,
      submission.subtaskScores
    );
  }
}
