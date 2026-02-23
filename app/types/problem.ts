/**
 * Problem-related types - re-exports from database.ts for backwards compatibility
 */

// Re-export types from database.ts
export type { ProblemType, Problem } from "./database";
export { getMaxScore, DEFAULT_PROBLEM } from "./database";

/**
 * Problem list item for UI display (subset of Problem fields)
 */
export interface ProblemListItem {
  problemName: string;
  title: string;
  problem_type: import("./database").ProblemType;
  validated: boolean;
  yourScore: number;
}
