/**
 * Users Database Service
 *
 * Provides CRUD operations for user accounts using DynamoDB.
 */

import type { User, UserRole, ContestParticipation } from "~/types/database";
import { DEFAULT_USER, formatDateTime } from "~/types/database";
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
 * Get all users
 */
export async function listUsers(): Promise<User[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.users,
    })
  );
  return (result.Items || []) as User[];
}

/**
 * Get a user by username
 */
export async function getUser(username: string): Promise<User | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.users,
      Key: { username },
    })
  );
  return (result.Item as User) || null;
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  role: UserRole,
  data?: Partial<User>
): Promise<User> {
  const user: User = {
    ...DEFAULT_USER,
    ...data,
    username,
    role,
    fullname: data?.fullname || username,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.users,
      Item: user,
      ConditionExpression: "attribute_not_exists(username)",
    })
  );

  return user;
}

/**
 * Update a user
 */
export async function updateUser(
  username: string,
  updates: Partial<Omit<User, "username">>
): Promise<User | null> {
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
    return getUser(username);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.users,
      Key: { username },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as User) || null;
}

/**
 * Delete a user
 */
export async function deleteUser(username: string): Promise<boolean> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.users,
      Key: { username },
    })
  );
  return true;
}

// =============================================================================
// MULTI-CONTEST FUNCTIONS
// =============================================================================

/**
 * Get user's active contests
 */
export async function getUserActiveContests(username: string): Promise<Record<string, ContestParticipation>> {
  const user = await getUser(username);
  if (!user) return {};

  return user.activeContests;
}

/**
 * Add user to a contest
 */
export async function addUserToContest(
  username: string,
  contestId: string,
  status: "invited" | "started" = "invited"
): Promise<void> {
  const user = await getUser(username);
  if (!user) {
    throw new Error(`User ${username} not found`);
  }

  const participation: ContestParticipation = {
    status,
    joinedAt: formatDateTime(new Date()),
    ...(status === "started" && { startedAt: formatDateTime(new Date()) }),
  };

  const updates: Partial<User> = {
    activeContests: {
      ...user.activeContests,
      [contestId]: participation,
    },
  };

  await updateUser(username, updates);
}

/**
 * Remove user from a contest
 */
export async function removeUserFromContest(
  username: string,
  contestId: string
): Promise<void> {
  const user = await getUser(username);
  if (!user) return;

  const { [contestId]: _, ...remainingContests } = user.activeContests;

  await updateUser(username, {
    activeContests: remainingContests,
  });
}

/**
 * Update user's contest participation status
 */
export async function updateUserContestStatus(
  username: string,
  contestId: string,
  updates: Partial<ContestParticipation>
): Promise<void> {
  const user = await getUser(username);
  if (!user || !user.activeContests[contestId]) {
    throw new Error(`User ${username} is not in contest ${contestId}`);
  }

  const currentParticipation = user.activeContests[contestId];
  const updatedParticipation: ContestParticipation = {
    ...currentParticipation,
    ...updates,
  };

  await updateUser(username, {
    activeContests: {
      ...user.activeContests,
      [contestId]: updatedParticipation,
    },
  });
}

/**
 * Get user's contest-specific scores
 */
export async function getUserContestScores(
  username: string,
  contestId: string
): Promise<Record<string, number>> {
  const user = await getUser(username);
  if (!user) return {};

  return user.contestScores[contestId] || {};
}

/**
 * Update user's score for a specific contest
 */
export async function updateUserContestScore(
  username: string,
  contestId: string,
  problemName: string,
  score: number,
  submissionTime: string
): Promise<void> {
  const user = await getUser(username);
  if (!user) return;

  const currentContestScores = user.contestScores[contestId] || {};
  const currentScore = currentContestScores[problemName] || 0;

  const currentContestSubmissions = user.contestSubmissions[contestId] || {};
  const currentSubmissions = currentContestSubmissions[problemName] || 0;

  const currentLatestSubmissions = user.contestLatestSubmissions[contestId] || {};

  const updates: Partial<User> = {
    contestSubmissions: {
      ...user.contestSubmissions,
      [contestId]: {
        ...currentContestSubmissions,
        [problemName]: currentSubmissions + 1,
      },
    },
    contestLatestSubmissions: {
      ...user.contestLatestSubmissions,
      [contestId]: {
        ...currentLatestSubmissions,
        [problemName]: submissionTime,
      },
    },
  };

  // Update score if it's better
  if (score > currentScore) {
    updates.contestScores = {
      ...user.contestScores,
      [contestId]: {
        ...currentContestScores,
        [problemName]: score,
      },
    };

    // Update participation final score if this contest is completed
    if (user.activeContests[contestId]?.status === "completed") {
      const contestParticipation = user.activeContests[contestId];
      const allContestScores = {
        ...currentContestScores,
        [problemName]: score,
      };
      const totalScore = Object.values(allContestScores).reduce((sum, s) => sum + s, 0);

      updates.activeContests = {
        ...user.activeContests,
        [contestId]: {
          ...contestParticipation,
          finalScore: totalScore,
        },
      };
    }
  }

  await updateUser(username, updates);
}

/**
 * Check if user can access a specific contest
 */
export async function canUserAccessContest(
  username: string,
  contestId: string
): Promise<boolean> {
  const activeContests = await getUserActiveContests(username);
  return contestId in activeContests;
}
