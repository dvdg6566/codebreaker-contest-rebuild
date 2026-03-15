/**
 * WebSocket Broadcast Service
 *
 * Broadcasts real-time notifications via AWS Step Functions.
 * Matches the original Python implementation in awstools/websocket.py
 */

import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// Configuration
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
  accountId: process.env.AWS_ACCOUNT_ID || "927878278795",
};

// Step Function ARN for WebSocket broadcasts
const WEBSOCKET_STEP_FUNCTION_ARN = `arn:aws:states:${config.region}:${config.accountId}:stateMachine:${config.judgeName}-websocket`;

// DynamoDB table for WebSocket connections
const WEBSOCKET_TABLE = `${config.judgeName}-websocket`;

// Batch size for connectionIds
const BLOCK_SIZE = 100;

// Create clients
const sfnClient = new SFNClient({
  region: config.region,
});

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: config.region })
);

/**
 * Helper to scan entire table with pagination
 */
async function scanTable(
  projectionExpression?: string
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoClient.send(
      new ScanCommand({
        TableName: WEBSOCKET_TABLE,
        ProjectionExpression: projectionExpression,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      results.push(...response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return results;
}

/**
 * Invoke Step Function with batched connectionIds
 */
async function invoke(
  items: Record<string, unknown>[],
  notificationType: string
): Promise<void> {
  const connectionIds = items
    .map((i) => i.connectionId as string)
    .filter(Boolean);

  if (connectionIds.length === 0) {
    return;
  }

  // Group items in sets of BLOCK_SIZE
  const buckets: string[][] = [];
  for (let i = 0; i < connectionIds.length; i += BLOCK_SIZE) {
    buckets.push(connectionIds.slice(i, i + BLOCK_SIZE));
  }

  // Format for Step Function
  const sfInput = buckets.map((bucket) => ({
    notificationType,
    connectionIds: bucket,
  }));

  try {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: WEBSOCKET_STEP_FUNCTION_ARN,
        input: JSON.stringify(sfInput),
      })
    );
  } catch (error) {
    console.error("Failed to broadcast WebSocket message:", error);
  }
}

/**
 * Broadcast announcement to all users
 */
export async function announce(): Promise<void> {
  const items = await scanTable("connectionId");
  await invoke(items, "announce");
}

/**
 * Notify all admins of a new clarification
 */
export async function postClarification(): Promise<void> {
  const response = await dynamoClient.send(
    new QueryCommand({
      TableName: WEBSOCKET_TABLE,
      IndexName: "accountRoleUsernameIndex",
      KeyConditionExpression: "accountRole = :role",
      ExpressionAttributeValues: { ":role": "admin" },
      ProjectionExpression: "connectionId",
    })
  );

  await invoke(response.Items || [], "postClarification");
}

/**
 * Notify a specific user that their clarification was answered
 */
export async function answerClarification(
  role: string,
  username: string
): Promise<void> {
  const response = await dynamoClient.send(
    new QueryCommand({
      TableName: WEBSOCKET_TABLE,
      IndexName: "accountRoleUsernameIndex",
      KeyConditionExpression: "accountRole = :role AND username = :username",
      ExpressionAttributeValues: { ":role": role, ":username": username },
      ProjectionExpression: "connectionId",
    })
  );

  await invoke(response.Items || [], "answerClarification");
}

