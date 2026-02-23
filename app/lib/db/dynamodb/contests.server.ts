/**
 * DynamoDB Contests Service
 *
 * CRUD operations for the contests table in DynamoDB.
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
} from "../dynamodb-client.server";

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
 * List all contests
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
 * List all contests with computed status
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
 * Create a new contest
 */
export async function createContest(
  contestId: string,
  data: Partial<Contest> = {}
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
  // Build update expression dynamically
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
 * Update a user's score in a contest
 */
export async function updateContestScore(
  contestId: string,
  username: string,
  problemName: string,
  score: number
): Promise<void> {
  const contest = await getContest(contestId);
  if (!contest) return;

  const userScores = contest.scores?.[username] || {};
  const currentScore = userScores[problemName] || 0;

  // Only update if new score is better
  if (score > currentScore) {
    await updateContest(contestId, {
      scores: {
        ...contest.scores,
        [username]: {
          ...userScores,
          [problemName]: score,
        },
      },
    });
  }
}

/**
 * Get the active/ongoing contest
 */
export async function getActiveContest(): Promise<Contest | null> {
  const contests = await listContestsWithStatus();
  return contests.find((c) => c.status === "ONGOING") || null;
}
