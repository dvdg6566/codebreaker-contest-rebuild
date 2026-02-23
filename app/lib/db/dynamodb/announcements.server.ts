/**
 * DynamoDB Announcements Service
 *
 * CRUD operations for the announcements table in DynamoDB.
 */

import type { Announcement } from "~/types/database";
import { formatDateTime } from "~/types/database";
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
 * Generate a UUID for announcements
 */
function generateAnnouncementId(): string {
  return crypto.randomUUID();
}

/**
 * List all announcements (sorted by time, newest first)
 */
export async function listAnnouncements(): Promise<Announcement[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableNames.announcements,
    })
  );

  const items = (result.Items || []) as Announcement[];

  // Sort by announcement time, newest first
  return items.sort((a, b) =>
    b.announcementTime.localeCompare(a.announcementTime)
  );
}

/**
 * Get an announcement by ID
 */
export async function getAnnouncement(
  announcementId: string
): Promise<Announcement | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.announcements,
      Key: { announcementId },
    })
  );

  return (result.Item as Announcement) || null;
}

/**
 * Create a new announcement
 */
export async function createAnnouncement(
  title: string,
  text: string,
  author?: string,
  priority?: "low" | "normal" | "high"
): Promise<Announcement> {
  const announcement: Announcement = {
    announcementId: generateAnnouncementId(),
    title,
    text,
    announcementTime: formatDateTime(new Date()),
    author,
    priority,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.announcements,
      Item: announcement,
    })
  );

  return announcement;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
  announcementId: string,
  updates: Partial<Omit<Announcement, "announcementId">>
): Promise<Announcement | null> {
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
    return getAnnouncement(announcementId);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.announcements,
      Key: { announcementId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as Announcement) || null;
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(
  announcementId: string
): Promise<boolean> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.announcements,
      Key: { announcementId },
    })
  );

  return true;
}
