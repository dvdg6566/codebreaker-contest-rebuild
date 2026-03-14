/**
 * Contests Database Service
 *
 * Provides CRUD operations for contests using DynamoDB.
 */

import type { Contest, ContestStatus, UserContestView, UserContestStatus } from "~/types/database";
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
import {
  scheduleContestEnd,
  cancelContestEndSchedule,
} from "../scheduler.server";

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

  // Schedule end notification for centralized contests
  if (contest.mode === "centralized" && !isDateTimeNotSet(contest.endTime)) {
    const endTime = parseDateTime(contest.endTime);
    await scheduleContestEnd(contestId, endTime);
  }

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

  const updatedContest = (result.Attributes as Contest) || null;

  // Reschedule end notification if endTime or mode changed
  if (updatedContest && ("endTime" in updates || "mode" in updates)) {
    if (updatedContest.mode === "centralized" && !isDateTimeNotSet(updatedContest.endTime)) {
      const endTime = parseDateTime(updatedContest.endTime);
      await scheduleContestEnd(contestId, endTime);
    } else {
      // Cancel schedule if switched to self-timer or no end time
      await cancelContestEndSchedule(contestId);
    }
  }

  return updatedContest;
}

/**
 * Delete a contest
 */
export async function deleteContest(contestId: string): Promise<boolean> {
  // Cancel any scheduled end notification
  await cancelContestEndSchedule(contestId);

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
 * Add a user to a contest (contest side of dual ownership)
 */
export async function addUserToContestRecord(
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
 * Remove a user from a contest (contest side of dual ownership)
 */
export async function removeUserFromContestRecord(
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
  return addUserToContestRecord(contestId, username, true);
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
 * Get contests assigned to a specific user with computed status and participation info
 */
export async function getUserContests(username: string): Promise<UserContestView[]> {
  // Get all contests first
  const allContests = await listContests();

  // Filter contests where user is explicitly assigned
  const userContests = allContests.filter(contest => {
    return contest.users && username in contest.users;
  });

  // Map to UserContestView with computed status and user participation
  return userContests.map(contest => {
    const status = getContestStatus(contest);
    const userInContest = contest.users?.[username];

    // Determine user status (user must be assigned since we filtered above)
    let userStatus: UserContestStatus;
    if (userInContest === "0") {
      userStatus = "invited";
    } else {
      userStatus = status === "ENDED" ? "completed" : "started";
    }

    // Calculate time remaining for active contests
    let timeRemaining: number | undefined;
    if (status === "ONGOING") {
      const now = new Date();
      if (contest.mode === "centralized") {
        const endTime = parseDateTime(contest.endTime);
        timeRemaining = Math.max(0, (endTime.getTime() - now.getTime()) / 1000);
      }
      // For self-timer mode, time remaining would need individual user participation data
      // This would require integration with the contest.server.ts participation system
    }

    // Determine if user can start contest (self-timer mode only)
    const canStart = contest.mode === "self-timer" &&
                    (status === "NOT_STARTED" || status === "ONGOING") &&
                    userStatus === "invited";

    // Determine if user can view contest content
    const canView = status === "ONGOING" &&
                   (userStatus === "started" || (contest.mode === "centralized" && userStatus === "invited"));

    return {
      contestId: contest.contestId,
      contestName: contest.contestName,
      description: contest.description,
      status,
      mode: contest.mode || "centralized",
      userStatus,
      startTime: contest.startTime,
      endTime: contest.endTime,
      duration: contest.duration,
      timeRemaining,
      problems: contest.problems,
      canStart,
      canView,
      public: contest.public,
    };
  }).sort((a, b) => {
    // Sort: ongoing first, then by start time
    if (a.status === "ONGOING" && b.status !== "ONGOING") return -1;
    if (b.status === "ONGOING" && a.status !== "ONGOING") return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
}

