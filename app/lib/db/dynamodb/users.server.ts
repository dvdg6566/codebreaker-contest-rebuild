/**
 * DynamoDB Users Service
 *
 * CRUD operations for the users table in DynamoDB.
 */

import type { User, UserRole } from "~/types/database";
import { DEFAULT_USER } from "~/types/database";
import {
  docClient,
  TableNames,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from "../dynamodb-client.server";

/**
 * List all users
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
 * List users in a specific contest
 */
export async function listUsersByContest(contestId: string): Promise<User[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.users,
      IndexName: "contestIndex",
      KeyConditionExpression: "contestId = :contestId",
      ExpressionAttributeValues: {
        ":contestId": contestId,
      },
    })
  );

  // GSI is KEYS_ONLY, so we need to fetch full items
  const usernames = (result.Items || []).map((item) => item.username as string);
  const users: User[] = [];

  for (const username of usernames) {
    const user = await getUser(username);
    if (user) users.push(user);
  }

  return users;
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
  role: UserRole = "member",
  data: Partial<User> = {}
): Promise<User> {
  const user: User = {
    ...DEFAULT_USER,
    ...data,
    username,
    role,
    fullname: data.fullname || username,
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

/**
 * Update user's problem score (if better than current)
 */
export async function updateUserScore(
  username: string,
  problemName: string,
  score: number,
  submissionTime: string
): Promise<void> {
  // Get current user to check existing score
  const user = await getUser(username);
  if (!user) return;

  const currentScore = user.problemScores[problemName] || 0;
  const currentSubmissions = user.problemSubmissions[problemName] || 0;

  // Always update submission count and latest submission time
  const updates: Partial<User> = {
    problemSubmissions: {
      ...user.problemSubmissions,
      [problemName]: currentSubmissions + 1,
    },
    latestSubmissions: {
      ...user.latestSubmissions,
      [problemName]: submissionTime,
    },
  };

  // Only update score if better
  if (score > currentScore) {
    updates.problemScores = {
      ...user.problemScores,
      [problemName]: score,
    };
    updates.latestScoreChange = submissionTime;
  }

  await updateUser(username, updates);
}

/**
 * Assign user to a contest
 */
export async function assignUserToContest(
  username: string,
  contestId: string
): Promise<void> {
  await updateUser(username, { contest: contestId });
}
