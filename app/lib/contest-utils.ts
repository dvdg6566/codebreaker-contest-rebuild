/**
 * Contest Utilities
 *
 * Centralized contest status and timing functions.
 */

import type { Contest } from "~/types/database";

/**
 * Check if a contest is currently ongoing
 */
export function isContestOngoing(contest: Contest): boolean {
  if (!contest?.endTime || contest.endTime === "9999-12-31 23:59:59") {
    return false; // No end time set means contest is not ongoing
  }

  try {
    const now = new Date();
    const endTime = new Date(contest.endTime.replace(" ", "T") + "Z");
    return now < endTime;
  } catch {
    return false; // Invalid date format
  }
}

/**
 * Parse contest date string to Date object
 */
export function parseContestDate(dateStr: string): Date | null {
  try {
    return new Date(dateStr.replace(" ", "T") + "Z");
  } catch {
    return null;
  }
}

/**
 * Check if contest date is "not set" (using sentinel value)
 */
export function isContestDateNotSet(dateStr: string): boolean {
  return !dateStr || dateStr === "9999-12-31 23:59:59";
}