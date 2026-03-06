/**
 * DynamoDB Schema-Aligned Type Definitions
 *
 * These types match the AWS DynamoDB schema from the Codebreaker Contest Manager.
 * Field names, types, and structures are designed for seamless migration to AWS.
 *
 * Datetime Format: "YYYY-MM-DD HH:MM:SS" (UTC)
 */

// =============================================================================
// USERS TABLE
// =============================================================================

export type UserRole = "admin" | "member";

/**
 * User account stored in DynamoDB
 * PK: username
 * GSI: contestIndex (on contest field)
 */
export interface User {
  /** Primary Key - Unique username */
  username: string;
  /** User role: "admin" or "member" (not "contestant") */
  role: UserRole;
  /** Display name (defaults to username) */
  fullname: string;
  /** User email */
  email: string;
  /** Custom label/tag for categorization */
  label: string;
  /** Currently assigned contest ID */
  contest: string;
  /** Best scores per problem: { problemName: score } */
  problemScores: Record<string, number>;
  /** Submission counts per problem: { problemName: count } */
  problemSubmissions: Record<string, number>;
  /** Latest submission timestamps per problem: { problemName: "YYYY-MM-DD HH:MM:SS" } */
  latestSubmissions: Record<string, string>;
  /** Timestamp of last score change */
  latestScoreChange: string;
}

/** Default values for new users */
export const DEFAULT_USER: Omit<User, "username" | "role"> = {
  fullname: "",
  email: "",
  label: "",
  contest: "",
  problemScores: {},
  problemSubmissions: {},
  latestSubmissions: {},
  latestScoreChange: "",
};

// =============================================================================
// CONTESTS TABLE
// =============================================================================

export type ContestMode = "centralized" | "self-timer";
export type ContestStatus = "NOT_STARTED" | "ONGOING" | "ENDED";

/**
 * Contest definition stored in DynamoDB
 * PK: contestId
 */
export interface Contest {
  /** Primary Key - Unique contest identifier */
  contestId: string;
  /** Display name for the contest */
  contestName: string;
  /** Ordered list of problem IDs */
  problems: string[];
  /** Start time in UTC: "YYYY-MM-DD HH:MM:SS" */
  startTime: string;
  /** End time in UTC: "YYYY-MM-DD HH:MM:SS" */
  endTime: string;
  /** Maximum submissions per problem (-1 = unlimited) */
  subLimit: number;
  /** Minimum seconds between submissions */
  subDelay: number;

  // Extended fields (not in reference DynamoDB, but useful for enhanced features)
  /** Contest description/rules */
  description?: string;
  /** Duration in minutes for self-timer mode */
  duration?: number;
  /** Contest timing mode */
  mode?: ContestMode;
  /** User assignments: { username: "0" (invited) | "1" (started) } */
  users?: Record<string, "0" | "1">;
  /** Cached subtask scores: { username: { problemName: [subtask0Best, subtask1Best, ...] } }
   *  IOI-style scoring: total score = sum of best score per subtask across all submissions */
  scores?: Record<string, Record<string, number[]>>;
  /** Whether contest is publicly visible */
  public?: boolean;
  /** Whether scoreboard is publicly visible */
  publicScoreboard?: boolean;
  /** Contest creation timestamp */
  createdAt?: string;
}

/** Default values for new contests */
export const DEFAULT_CONTEST: Omit<Contest, "contestId"> = {
  contestName: "New Contest",
  problems: [],
  startTime: "9999-12-31 23:59:59",
  endTime: "9999-12-31 23:59:59",
  subLimit: 50,
  subDelay: 60,
  description: "",
  duration: 180,
  mode: "centralized",
  users: {},
  scores: {},
  public: false,
  publicScoreboard: false,
};

// =============================================================================
// PROBLEMS TABLE
// =============================================================================

export type ProblemType = "Batch" | "Interactive" | "Communication";

/**
 * Problem definition stored in DynamoDB
 * PK: problemName
 */
export interface Problem {
  /** Primary Key - Unique problem identifier */
  problemName: string;
  /** Display title (defaults to problemName) */
  title: string;
  /** Problem type for grading */
  problem_type: ProblemType;
  /** Time limit in seconds */
  timeLimit: number;
  /** Memory limit in MB */
  memoryLimit: number;
  /** Number of test cases */
  testcaseCount: number;
  /** Points per subtask (sum = max score) */
  subtaskScores: number[];
  /** Testcase ranges per subtask: ["1-3", "4-10", ...] */
  subtaskDependency: string[];
  /** Whether problem has downloadable attachments */
  attachments: boolean;
  /** Whether problem uses a custom checker */
  customChecker: boolean;
  /** Whether to show all test results (vs. first failure only) */
  fullFeedback: boolean;
  /** Whether problem is ready for submissions */
  validated: boolean;

  // Extended fields (not in reference DynamoDB)
  /** Problem source/origin */
  source?: string;
  /** Difficulty level for UI display */
  difficulty?: "easy" | "medium" | "hard";
  /** Tags for categorization */
  tags?: string[];

  // For Communication problems
  nameA?: string;
  nameB?: string;

  // Validation info (stored in DynamoDB by problem-validation Lambda)
  // Verdicts use 0/1 (not true/false) to match Lambda response
  verdicts?: {
    testdata: number;
    statement: number;
    scoring: number;
    attachments: number;
    checker: number;
    grader: number;
    subtasks: number;
  };
  remarks?: {
    testdata: string;
    statement: string;
    scoring: string;
    attachments: string;
    checker: string;
    grader: string;
    subtasks: string;
  };
}

/** Default values for new problems */
export const DEFAULT_PROBLEM: Omit<Problem, "problemName"> = {
  title: "",
  problem_type: "Batch",
  timeLimit: 1,
  memoryLimit: 1024,
  testcaseCount: 0,
  subtaskScores: [100],
  subtaskDependency: ["1"],
  attachments: false,
  customChecker: false,
  fullFeedback: true,
  validated: false,
};

// =============================================================================
// SUBMISSIONS TABLE
// =============================================================================

/**
 * Submission record stored in DynamoDB
 * PK: subId (Number)
 * GSIs: usernameIndex (username), problemIndex (problemName)
 */
export interface Submission {
  /** Primary Key - Auto-incremented submission ID */
  subId: number;
  /** Username of submitter */
  username: string;
  /** Problem identifier */
  problemName: string;
  /** Submission time: "YYYY-MM-DD HH:MM:SS" */
  submissionTime: string;
  /** When grading started */
  gradingTime?: string;
  /** When grading completed */
  gradingCompleteTime: string;
  /** Programming language: "cpp", "py", "java" */
  language: string;
  /** Per-testcase scores */
  score: number[];
  /** Per-testcase verdicts: "AC", "WA", "TLE", "MLE", "RTE", ":(" (pending) */
  verdicts: string[];
  /** Per-testcase runtimes in ms */
  times: number[];
  /** Per-testcase memory usage in KB */
  memories: number[];
  /** Per-testcase exit codes */
  returnCodes: number[];
  /** Per-testcase grading status: 1=pending, 2=complete */
  status: number[];
  /** Per-subtask scores */
  subtaskScores: number[];
  /** Total/final score */
  totalScore: number;
  /** Peak runtime across all testcases (ms) */
  maxTime: number;
  /** Peak memory across all testcases (KB) */
  maxMemory: number;
  /** Compilation error message (if CE) */
  compileErrorMessage?: string;
}

/** Verdict type for display */
export type SubmissionVerdict = "AC" | "WA" | "TLE" | "MLE" | "RTE" | "CE" | "pending";

/**
 * Get overall verdict from submission data
 */
export function getSubmissionVerdict(submission: Submission): SubmissionVerdict {
  // Handle missing data gracefully
  if (!submission.status || !submission.verdicts) {
    return "pending";
  }

  // Check if still grading
  if (submission.status.slice(1).some(s => s === 1)) {
    return "pending";
  }

  // Check for compile error
  if (submission.compileErrorMessage) {
    return "CE";
  }

  // Check verdicts - if all AC, return AC
  if (submission.verdicts.slice(1).every(v => v === "AC")) {
    return "AC";
  }

  // Return first non-AC verdict
  const nonAc = submission.verdicts.slice(1).find(v => v !== "AC" && v !== ":(");
  if (nonAc === "TLE") return "TLE";
  if (nonAc === "MLE") return "MLE";
  if (nonAc === "RTE" || nonAc === "RE") return "RTE";

  return "WA";
}

/**
 * Calculate max score from problem subtask scores
 */
export function getMaxScore(problem: Pick<Problem, "subtaskScores">): number {
  return problem.subtaskScores.reduce((sum, s) => sum + s, 0);
}

// =============================================================================
// ANNOUNCEMENTS TABLE
// =============================================================================

/**
 * Announcement stored in DynamoDB
 * PK: announcementId
 */
export interface Announcement {
  /** Primary Key - UUID */
  announcementId: string;
  /** Announcement title */
  title: string;
  /** Announcement body text */
  text: string;
  /** Posted time: "YYYY-MM-DD HH:MM:SS" */
  announcementTime: string;

  // Extended fields (not in reference DynamoDB)
  /** Priority level for display styling */
  priority?: "low" | "normal" | "high";
  /** Author username */
  author?: string;
}

// =============================================================================
// CLARIFICATIONS TABLE
// =============================================================================

/**
 * Clarification Q&A stored in DynamoDB
 * PK: askedBy (username)
 * SK: clarificationTime
 */
export interface Clarification {
  /** Partition Key - Username who asked */
  askedBy: string;
  /** Sort Key - Time asked: "YYYY-MM-DD HH:MM:SS" */
  clarificationTime: string;
  /** Related problem (empty string for general questions) */
  problemName: string;
  /** The question text */
  question: string;
  /** Answer text (empty string if pending) */
  answer: string;
  /** Username of admin who answered */
  answeredBy: string;
}

/**
 * Get clarification status (derived, not stored)
 */
export function getClarificationStatus(
  clarification: Pick<Clarification, "answer">
): "pending" | "answered" {
  return clarification.answer === "" ? "pending" : "answered";
}

// =============================================================================
// GLOBAL COUNTERS TABLE
// =============================================================================

/**
 * Global counter for ID generation
 * PK: counterId
 */
export interface GlobalCounter {
  /** Counter name, e.g., "submissionId" */
  counterId: string;
  /** Current counter value */
  value: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Format a Date to DynamoDB datetime string
 */
export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Parse DynamoDB datetime string to Date
 */
export function parseDateTime(dateStr: string): Date {
  // Handle "9999-12-31 23:59:59" as "not set"
  if (dateStr.startsWith("9999")) {
    return new Date("9999-12-31T23:59:59Z");
  }
  // Convert "YYYY-MM-DD HH:MM:SS" to ISO format
  const isoStr = dateStr.replace(" ", "T") + "Z";
  return new Date(isoStr);
}

/**
 * Check if a datetime represents "not set" (far future)
 */
export function isDateTimeNotSet(dateStr: string): boolean {
  return dateStr.startsWith("9999");
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "admin";
}

export function isMember(user: Pick<User, "role">): boolean {
  return user.role === "member";
}
