/**
 * Contests Database Service
 *
 * Provides CRUD operations for contests using DynamoDB.
 */

import type { Contest, ContestStatus } from "~/types/database";
import { DEFAULT_CONTEST, parseDateTime, isDateTimeNotSet } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "./dynamodb-client.server";

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
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.contests,
    })
  );
  return (result.Items || []) as Contest[];
}

/**
 * Get all contests with computed status
 */
export async function listContestsWithStatus(): Promise<
  (Contest & { status: ContestStatus })[]
> {
  const contests = await listContests();
  return contests.map((contest) => ({
    ...contest,
    status: getContestStatus(contest),
  }));
}

/**
 * Get a contest by ID
 */
export async function getContest(contestId: string): Promise<Contest | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.contests,
      Key: { contestId },
    })
  );
  return (result.Item as Contest) || null;
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
  const contest: Contest = {
    ...DEFAULT_CONTEST,
    ...data,
    contestId,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.contests,
      Item: contest,
      ConditionExpression: "attribute_not_exists(contestId)",
    })
  );

  return contest;
}

/**
 * Update a contest
 */
export async function updateContest(
  contestId: string,
  updates: Partial<Omit<Contest, "contestId">>
): Promise<Contest | null> {
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
    return getContest(contestId);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.contests,
      Key: { contestId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Contest) || null;
}

/**
 * Delete a contest
 */
export async function deleteContest(contestId: string): Promise<boolean> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.contests,
      Key: { contestId },
    })
  );
  return true;
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
  const contest = await getContest(contestId);
  if (!contest) return null;

  if (contest.problems.includes(problemName)) {
    return contest;
  }

  return updateContest(contestId, {
    problems: [...contest.problems, problemName],
  });
}

/**
 * Remove a problem from a contest
 */
export async function removeProblemFromContest(
  contestId: string,
  problemName: string
): Promise<Contest | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;

  return updateContest(contestId, {
    problems: contest.problems.filter((p) => p !== problemName),
  });
}

/**
 * Add a user to a contest
 */
export async function addUserToContest(
  contestId: string,
  username: string,
  started: boolean = false
): Promise<Contest | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;

  return updateContest(contestId, {
    users: {
      ...contest.users,
      [username]: started ? "1" : "0",
    },
  });
}

/**
 * Remove a user from a contest
 */
export async function removeUserFromContest(
  contestId: string,
  username: string
): Promise<Contest | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;

  const { [username]: _, ...remainingUsers } = contest.users || {};

  return updateContest(contestId, {
    users: remainingUsers,
  });
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
 * Update user's subtask scores in a contest (IOI-style scoring)
 *
 * IOI-style scoring: total score = sum of best score per subtask across all submissions.
 * Each subtask score is updated independently if the new score is better.
 *
 * @param subtaskScores - Array of scores for each subtask from this submission
 */
export async function updateContestScore(
  contestId: string,
  username: string,
  problemName: string,
  subtaskScores: number[]
): Promise<Contest | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;

  const userScores = contest.scores?.[username] || {};
  const currentSubtaskScores = userScores[problemName] || [];

  // Update each subtask independently - take the maximum
  const newSubtaskScores = subtaskScores.map((score, index) => {
    const currentScore = currentSubtaskScores[index] || 0;
    return Math.max(score, currentScore);
  });

  // Check if any subtask improved
  const hasImprovement = newSubtaskScores.some(
    (score, index) => score > (currentSubtaskScores[index] || 0)
  );

  if (hasImprovement) {
    return updateContest(contestId, {
      scores: {
        ...contest.scores,
        [username]: {
          ...userScores,
          [problemName]: newSubtaskScores,
        },
      },
    });
  }

  return contest;
}

/**
 * Get user's total score for a problem (sum of best subtask scores)
 */
export function calculateProblemScore(subtaskScores: number[]): number {
  return subtaskScores.reduce((sum, score) => sum + score, 0);
}

/**
 * Get the active/ongoing contest
 */
export async function getActiveContest(): Promise<Contest | null> {
  const contests = await listContestsWithStatus();
  return contests.find((c) => c.status === "ONGOING") || null;
}
