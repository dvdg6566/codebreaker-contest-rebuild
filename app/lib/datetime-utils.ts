/**
 * DateTime Utilities
 *
 * Centralized date and time formatting functions.
 */

/**
 * Format a database datetime string for display
 * Converts "YYYY-MM-DD HH:mm:ss" to locale string
 */
export function formatDateTime(dateTime: string): string {
  try {
    return new Date(dateTime.replace(" ", "T") + "Z").toLocaleString();
  } catch {
    return dateTime; // Return original if parsing fails
  }
}

/**
 * Format a database datetime string for display with fallback for "not set" values
 */
export function formatDateTimeWithFallback(dateTimeStr: string): string {
  if (dateTimeStr === "9999-12-31 23:59:59") return "Not set";

  try {
    const date = new Date(dateTimeStr.replace(" ", "T") + "Z");
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
}

/**
 * Format a database datetime string for datetime-local input
 */
export function formatDateTimeLocal(dateStr: string): string {
  if (!dateStr || dateStr === "9999-12-31 23:59:59") return "";

  try {
    const date = new Date(dateStr.replace(" ", "T") + "Z");
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    return date.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}