/**
 * DynamoDB Global Counters Service
 *
 * Atomic counter operations for ID generation.
 */

import {
  docClient,
  TableNames,
  UpdateCommand,
  GetCommand,
} from "../dynamodb-client.server";

/**
 * Get the current value of a counter
 */
export async function getCounter(counterId: string): Promise<number> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.globalCounters,
      Key: { counterId },
    })
  );

  return (result.Item?.value as number) || 0;
}

/**
 * Increment a counter and return the new value
 * This is atomic - safe for concurrent use
 */
export async function incrementCounter(
  counterId: string,
  incrementBy: number = 1
): Promise<number> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.globalCounters,
      Key: { counterId },
      UpdateExpression: "SET #value = if_not_exists(#value, :zero) + :inc",
      ExpressionAttributeNames: {
        "#value": "value",
      },
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": incrementBy,
      },
      ReturnValues: "UPDATED_NEW",
    })
  );

  return result.Attributes?.value as number;
}

/**
 * Get the next submission ID
 */
export async function getNextSubmissionId(): Promise<number> {
  return incrementCounter("submissionId");
}

/**
 * Get the next announcement ID
 */
export async function getNextAnnouncementId(): Promise<number> {
  return incrementCounter("announcementId");
}
