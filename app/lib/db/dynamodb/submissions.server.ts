/**
 * DynamoDB Submissions Service
 *
 * CRUD operations for the submissions table in DynamoDB.
 */

import type { Submission } from "~/types/database";
import { formatDateTime } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from "../dynamodb-client.server";
import { getNextSubmissionId } from "./counters.server";

/**
 * List all submissions (limited)
 */
export async function listSubmissions(limit = 100): Promise<Submission[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.submissions,
      Limit: limit,
    })
  );

  // Sort by subId descending (newest first)
  const items = (result.Items || []) as Submission[];
  return items.sort((a, b) => b.subId - a.subId);
}

/**
 * List submissions by username
 */
export async function listSubmissionsByUser(
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
      ScanIndexForward: false, // Newest first
    })
  );

  return (result.Items || []) as Submission[];
}

/**
 * List submissions by problem
 */
export async function listSubmissionsByProblem(
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
      ScanIndexForward: false, // Newest first
    })
  );

  return (result.Items || []) as Submission[];
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
 * Create a new submission
 */
export async function createSubmission(
  username: string,
  problemName: string,
  language: string,
  testcaseCount: number
): Promise<Submission> {
  const subId = await getNextSubmissionId();
  const now = formatDateTime(new Date());

  const submission: Submission = {
    subId,
    username,
    problemName,
    language,
    submissionTime: now,
    gradingTime: now,
    gradingCompleteTime: "",
    score: Array(testcaseCount).fill(0),
    verdicts: Array(testcaseCount).fill(":("),
    times: Array(testcaseCount).fill(0),
    memories: Array(testcaseCount).fill(0),
    returnCodes: Array(testcaseCount).fill(0),
    status: Array(testcaseCount).fill(1), // 1 = pending
    subtaskScores: [], // Will be set when we know subtask structure
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
 * Update submission grading results for a single testcase
 */
export async function updateSubmissionTestcase(
  subId: number,
  testcaseIndex: number,
  result: {
    score: number;
    verdict: string;
    time: number;
    memory: number;
    returnCode: number;
  }
): Promise<void> {
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
        ":status": 2, // 2 = complete
      },
    })
  );
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
  const result = await docClient.send(
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
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Submission) || null;
}

/**
 * Set compile error on submission
 */
export async function setCompileError(
  subId: number,
  errorMessage: string
): Promise<Submission | null> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.submissions,
      Key: { subId },
      UpdateExpression: `
        SET compileErrorMessage = :errorMessage,
            gradingCompleteTime = :gradingCompleteTime
      `,
      ExpressionAttributeValues: {
        ":errorMessage": errorMessage,
        ":gradingCompleteTime": formatDateTime(new Date()),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Submission) || null;
}

/**
 * Get submissions count for a user on a problem
 */
export async function getSubmissionCount(
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
 * Get the latest submission for a user on a problem
 */
export async function getLatestSubmission(
  username: string,
  problemName: string
): Promise<Submission | null> {
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
      ScanIndexForward: false, // Newest first
    })
  );

  return ((result.Items || [])[0] as Submission) || null;
}
