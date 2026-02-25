/**
 * Global Counters Database Service
 *
 * Atomic counter operations for ID generation using DynamoDB.
 */

import {
  docClient,
  TableNames,
  UpdateCommand,
} from "./dynamodb-client.server";

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
