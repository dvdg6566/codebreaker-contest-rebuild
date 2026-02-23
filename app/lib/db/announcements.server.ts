/**
 * Announcements Database Service
 *
 * Provides CRUD operations for announcements.
 * Switches between mock data and DynamoDB based on USE_DYNAMODB env var.
 */

import type { Announcement } from "~/types/database";
import { formatDateTime } from "~/types/database";

const USE_DYNAMODB = process.env.USE_DYNAMODB === "true";

const dynamodb = USE_DYNAMODB
  ? await import("./dynamodb/announcements.server")
  : null;

import { mockAnnouncements } from "../mock-data";

// Counter for generating IDs (mock mode only)
let announcementIdCounter = mockAnnouncements.length;

/**
 * Get all announcements
 */
export async function listAnnouncements(): Promise<Announcement[]> {
  if (dynamodb) {
    return dynamodb.listAnnouncements();
  }
  return mockAnnouncements;
}

/**
 * Get announcements ordered by time (newest first)
 */
export async function listAnnouncementsByTime(): Promise<Announcement[]> {
  if (dynamodb) {
    return dynamodb.listAnnouncements(); // Already sorted
  }
  return [...mockAnnouncements].sort((a, b) =>
    b.announcementTime.localeCompare(a.announcementTime)
  );
}

/**
 * Get an announcement by ID
 */
export async function getAnnouncement(
  announcementId: string
): Promise<Announcement | null> {
  if (dynamodb) {
    return dynamodb.getAnnouncement(announcementId);
  }
  return (
    mockAnnouncements.find((a) => a.announcementId === announcementId) || null
  );
}

/**
 * Get announcements by priority
 */
export async function getAnnouncementsByPriority(
  priority: "low" | "normal" | "high"
): Promise<Announcement[]> {
  const all = await listAnnouncements();
  return all.filter((a) => a.priority === priority);
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
  if (dynamodb) {
    return dynamodb.createAnnouncement(title, text, author, priority);
  }

  const newAnnouncement: Announcement = {
    announcementId: `ann-${++announcementIdCounter}`,
    title,
    text,
    announcementTime: formatDateTime(new Date()),
    priority: priority || "normal",
    author,
  };

  mockAnnouncements.push(newAnnouncement);
  return newAnnouncement;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
  announcementId: string,
  updates: Partial<Announcement>
): Promise<Announcement | null> {
  // Don't allow changing announcementId (primary key)
  const { announcementId: _, ...safeUpdates } = updates as Announcement & {
    announcementId?: string;
  };

  if (dynamodb) {
    return dynamodb.updateAnnouncement(announcementId, safeUpdates);
  }

  const index = mockAnnouncements.findIndex(
    (a) => a.announcementId === announcementId
  );
  if (index === -1) return null;

  mockAnnouncements[index] = {
    ...mockAnnouncements[index],
    ...safeUpdates,
  };

  return mockAnnouncements[index];
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(
  announcementId: string
): Promise<boolean> {
  if (dynamodb) {
    return dynamodb.deleteAnnouncement(announcementId);
  }

  const index = mockAnnouncements.findIndex(
    (a) => a.announcementId === announcementId
  );
  if (index === -1) return false;

  mockAnnouncements.splice(index, 1);
  return true;
}

/**
 * Get announcement count
 */
export async function countAnnouncements(): Promise<number> {
  const all = await listAnnouncements();
  return all.length;
}

/**
 * Get recent announcements (last N)
 */
export async function getRecentAnnouncements(
  limit: number
): Promise<Announcement[]> {
  const sorted = await listAnnouncementsByTime();
  return sorted.slice(0, limit);
}
