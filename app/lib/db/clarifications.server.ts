/**
 * Clarifications Database Service
 *
 * Provides CRUD operations for clarifications (Q&A) using DynamoDB.
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
} from "./dynamodb-client.server";

// Re-export utility
export { getClarificationStatus };

/**
 * Get all clarifications (sorted by time, newest first)
 */
export async function listClarifications(): Promise<Clarification[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.clarifications,
    })
  );

  const items = (result.Items || []) as Clarification[];
  return items.sort((a, b) =>
    b.clarificationTime.localeCompare(a.clarificationTime)
  );
}

/**
 * Get a clarification by its composite key
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
 * Get clarifications by user
 */
export async function getClarificationsByUser(
  username: string
): Promise<Clarification[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.clarifications,
      KeyConditionExpression: "askedBy = :askedBy",
      ExpressionAttributeValues: {
        ":askedBy": username,
      },
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as Clarification[];
}

/**
 * Create a new clarification (ask a question)
 */
export async function createClarification(
  askedBy: string,
  question: string,
  problemName?: string
): Promise<Clarification> {
  const clarification: Clarification = {
    askedBy,
    clarificationTime: formatDateTime(new Date()),
    problemName: problemName || "",
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
 * Update a clarification's question (only if not answered)
 */
export async function updateClarificationQuestion(
  askedBy: string,
  clarificationTime: string,
  newQuestion: string
): Promise<Clarification | null> {
  const clarification = await getClarification(askedBy, clarificationTime);
  if (!clarification || clarification.answer !== "") return null;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.clarifications,
      Key: { askedBy, clarificationTime },
      UpdateExpression: "SET question = :question",
      ExpressionAttributeValues: {
        ":question": newQuestion,
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

/**
 * Count clarifications by status
 */
export async function countClarificationsByStatus(): Promise<{
  pending: number;
  answered: number;
  total: number;
}> {
  const all = await listClarifications();
  const pending = all.filter((c) => c.answer === "").length;
  const answered = all.filter((c) => c.answer !== "").length;
  return {
    pending,
    answered,
    total: all.length,
  };
}

/**
 * Count clarifications for a user
 */
export async function countUserClarifications(
  username: string
): Promise<{ pending: number; answered: number; total: number }> {
  const userClars = await getClarificationsByUser(username);
  const pending = userClars.filter((c) => c.answer === "").length;
  const answered = userClars.filter((c) => c.answer !== "").length;
  return {
    pending,
    answered,
    total: userClars.length,
  };
}

