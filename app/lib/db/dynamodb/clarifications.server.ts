/**
 * DynamoDB Clarifications Service
 *
 * CRUD operations for the clarifications table in DynamoDB.
 * Uses composite key: askedBy (PK) + clarificationTime (SK)
 */

import type { Clarification } from "~/types/database";
import { formatDateTime, getClarificationStatus } from "~/types/database";
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
 * List all clarifications (sorted by time, newest first)
 */
export async function listClarifications(): Promise<Clarification[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.clarifications,
    })
  );

  const items = (result.Items || []) as Clarification[];

  // Sort by clarification time, newest first
  return items.sort((a, b) =>
    b.clarificationTime.localeCompare(a.clarificationTime)
  );
}

/**
 * List pending clarifications (unanswered)
 */
export async function listPendingClarifications(): Promise<Clarification[]> {
  const all = await listClarifications();
  return all.filter((c) => getClarificationStatus(c) === "pending");
}

/**
 * List clarifications by user
 */
export async function listClarificationsByUser(
  askedBy: string
): Promise<Clarification[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.clarifications,
      KeyConditionExpression: "askedBy = :askedBy",
      ExpressionAttributeValues: {
        ":askedBy": askedBy,
      },
      ScanIndexForward: false, // Newest first
    })
  );

  return (result.Items || []) as Clarification[];
}

/**
 * Get a clarification by composite key
 */
export async function getClarification(
  askedBy: string,
  clarificationTime: string
): Promise<Clarification | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.clarifications,
      Key: { askedBy, clarificationTime },
    })
  );

  return (result.Item as Clarification) || null;
}

/**
 * Create a new clarification (question)
 */
export async function createClarification(
  askedBy: string,
  question: string,
  problemName: string = ""
): Promise<Clarification> {
  const clarification: Clarification = {
    askedBy,
    clarificationTime: formatDateTime(new Date()),
    problemName,
    question,
    answer: "",
    answeredBy: "",
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.clarifications,
      Item: clarification,
    })
  );

  return clarification;
}

/**
 * Answer a clarification
 */
export async function answerClarification(
  askedBy: string,
  clarificationTime: string,
  answer: string,
  answeredBy: string
): Promise<Clarification | null> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.clarifications,
      Key: { askedBy, clarificationTime },
      UpdateExpression: "SET answer = :answer, answeredBy = :answeredBy",
      ExpressionAttributeValues: {
        ":answer": answer,
        ":answeredBy": answeredBy,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Clarification) || null;
}

/**
 * Delete a clarification
 */
export async function deleteClarification(
  askedBy: string,
  clarificationTime: string
): Promise<boolean> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.clarifications,
      Key: { askedBy, clarificationTime },
    })
  );

  return true;
}
