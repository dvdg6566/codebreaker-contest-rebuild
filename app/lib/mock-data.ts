/**
 * Mock data for development without AWS DynamoDB
 *
 * This module provides mock data that matches the DynamoDB schema.
 * All data structures use the same field names and types as production.
 */

import type {
  User,
  Contest,
  Problem,
  Submission,
  Announcement,
  Clarification,
  ContestMode,
  ContestStatus,
  ProblemType,
  SubmissionVerdict,
} from "~/types/database";

import {
  formatDateTime,
  parseDateTime,
  isDateTimeNotSet,
  getSubmissionVerdict,
  getMaxScore,
  getClarificationStatus,
} from "~/types/database";

// Re-export types for convenience
export type { ContestMode, ContestStatus, ProblemType, SubmissionVerdict };

// =============================================================================
// USERS
// =============================================================================

/**
 * Mock user with password (password not stored in DynamoDB - Cognito handles auth)
 * For development/testing only
 */
export interface MockUser extends User {
  /** Development-only password field (Cognito handles auth in production) */
  password: string;
}

export const mockUsers: MockUser[] = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    fullname: "Administrator",
    email: "admin@codebreaker.local",
    label: "",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
  {
    username: "alice",
    password: "alice123",
    role: "member",
    fullname: "Alice Chen",
    email: "alice@example.com",
    label: "",
    contest: "contest-1",
    problemScores: { "prob-1": 100, "prob-2": 100, "prob-3": 30, "prob-4": 0 },
    problemSubmissions: { "prob-1": 1, "prob-2": 2, "prob-3": 3, "prob-4": 1 },
    latestSubmissions: {
      "prob-1": formatDateTime(new Date(Date.now() - 1000 * 60 * 30)),
      "prob-3": formatDateTime(new Date(Date.now() - 1000 * 60 * 20)),
      "prob-4": formatDateTime(new Date(Date.now() - 1000 * 60 * 2)),
    },
    latestScoreChange: formatDateTime(new Date(Date.now() - 1000 * 60 * 30)),
  },
  {
    username: "bob",
    password: "bob123",
    role: "member",
    fullname: "Bob Smith",
    email: "bob@example.com",
    label: "",
    contest: "contest-1",
    problemScores: { "prob-1": 60, "prob-2": 0, "prob-3": 0, "prob-4": 0 },
    problemSubmissions: { "prob-1": 1 },
    latestSubmissions: {
      "prob-1": formatDateTime(new Date(Date.now() - 1000 * 60 * 25)),
    },
    latestScoreChange: formatDateTime(new Date(Date.now() - 1000 * 60 * 25)),
  },
  {
    username: "charlie",
    password: "charlie123",
    role: "member",
    fullname: "Charlie Brown",
    email: "",
    label: "",
    contest: "contest-1",
    problemScores: { "prob-1": 100, "prob-2": 100, "prob-3": 0, "prob-4": 0 },
    problemSubmissions: { "prob-1": 2, "prob-2": 1 },
    latestSubmissions: {
      "prob-1": formatDateTime(new Date(Date.now() - 1000 * 60 * 40)),
      "prob-2": formatDateTime(new Date(Date.now() - 1000 * 60 * 15)),
    },
    latestScoreChange: formatDateTime(new Date(Date.now() - 1000 * 60 * 15)),
  },
];

// =============================================================================
// CONTESTS
// =============================================================================

export const mockContests: Contest[] = [
  {
    contestId: "contest-1",
    contestName: "Weekly Contest #42",
    description: "Regular weekly programming contest with algorithmic problems",
    editorial: "",
    editorialVisible: false,
    startTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 60)), // Started 1 hour ago
    endTime: formatDateTime(new Date(Date.now() + 1000 * 60 * 60 * 2)), // Ends in 2 hours
    duration: 180, // 3 hours
    mode: "centralized",
    problems: ["prob-1", "prob-2", "prob-3", "prob-4"],
    users: {
      alice: "1",
      bob: "1",
      charlie: "1",
    },
    scores: {
      alice: { "prob-1": 100, "prob-2": 100, "prob-3": 30, "prob-4": 0 },
      bob: { "prob-1": 60, "prob-2": 0, "prob-3": 0, "prob-4": 0 },
      charlie: { "prob-1": 100, "prob-2": 100, "prob-3": 0, "prob-4": 0 },
    },
    subLimit: 50,
    subDelay: 60,
    public: true,
    publicScoreboard: true,
    createdAt: formatDateTime(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)), // Created a week ago
  },
  {
    contestId: "contest-2",
    contestName: "Practice Round",
    description: "Practice problems for beginners. Start whenever you're ready!",
    editorial: "https://example.com/editorial",
    editorialVisible: false,
    startTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 60 * 24)), // Started yesterday
    endTime: formatDateTime(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)), // Ends in 30 days
    duration: 120, // 2 hours per user
    mode: "self-timer",
    problems: ["prob-5", "prob-6"],
    users: {},
    scores: {},
    subLimit: -1, // unlimited
    subDelay: 10,
    public: true,
    publicScoreboard: true,
    createdAt: formatDateTime(new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)), // Created 3 days ago
  },
  {
    contestId: "contest-3",
    contestName: "Private Training Session",
    description: "Invite-only training session for selected participants",
    editorial: "",
    editorialVisible: false,
    startTime: formatDateTime(new Date(Date.now() + 1000 * 60 * 60 * 24 * 2)), // Starts in 2 days
    endTime: formatDateTime(new Date(Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 60 * 3)), // 3 hours duration
    duration: 180,
    mode: "centralized",
    problems: ["prob-1", "prob-3", "prob-4"],
    users: {
      alice: "0", // Invited but not started
    },
    scores: {},
    subLimit: 10,
    subDelay: 30,
    public: false,
    publicScoreboard: false,
    createdAt: formatDateTime(new Date(Date.now() - 1000 * 60 * 60 * 24)), // Created yesterday
  },
];

// Helper to calculate contest status
export function getContestStatus(contest: Contest): ContestStatus {
  const now = new Date();
  const startTime = parseDateTime(contest.startTime);
  const endTime = parseDateTime(contest.endTime);

  if (now < startTime) return "NOT_STARTED";
  if (!isDateTimeNotSet(contest.endTime) && now >= endTime) return "ENDED";
  return "ONGOING";
}

// =============================================================================
// PROBLEMS
// =============================================================================

export const mockProblems: Problem[] = [
  {
    problemName: "prob-1",
    title: "Two Sum",
    problem_type: "Batch",
    difficulty: "easy",
    timeLimit: 1, // seconds
    memoryLimit: 256,
    testcaseCount: 10,
    subtaskScores: [30, 70],
    subtaskDependency: ["1-3", "4-10"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["array", "hash-table"],
  },
  {
    problemName: "prob-2",
    title: "Binary Search",
    problem_type: "Batch",
    difficulty: "easy",
    timeLimit: 1,
    memoryLimit: 256,
    testcaseCount: 15,
    subtaskScores: [100],
    subtaskDependency: ["1-15"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["binary-search", "array"],
  },
  {
    problemName: "prob-3",
    title: "Longest Substring",
    problem_type: "Batch",
    difficulty: "medium",
    timeLimit: 2,
    memoryLimit: 256,
    testcaseCount: 20,
    subtaskScores: [30, 30, 40],
    subtaskDependency: ["1-5", "6-12", "13-20"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["string", "sliding-window", "hash-table"],
  },
  {
    problemName: "prob-4",
    title: "Graph Traversal",
    problem_type: "Batch",
    difficulty: "hard",
    timeLimit: 3,
    memoryLimit: 512,
    testcaseCount: 25,
    subtaskScores: [10, 30, 60],
    subtaskDependency: ["1-5", "6-15", "16-25"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["graph", "dfs", "bfs"],
  },
  {
    problemName: "prob-5",
    title: "Hello World",
    problem_type: "Batch",
    difficulty: "easy",
    timeLimit: 1,
    memoryLimit: 256,
    testcaseCount: 1,
    subtaskScores: [100],
    subtaskDependency: ["1"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["implementation"],
  },
  {
    problemName: "prob-6",
    title: "Sum of Two Numbers",
    problem_type: "Batch",
    difficulty: "easy",
    timeLimit: 1,
    memoryLimit: 256,
    testcaseCount: 10,
    subtaskScores: [100],
    subtaskDependency: ["1-10"],
    attachments: false,
    customChecker: false,
    fullFeedback: true,
    validated: true,
    tags: ["math", "implementation"],
  },
];

// =============================================================================
// SUBMISSIONS
// =============================================================================

// Counter for generating submission IDs
let submissionCounter = 5;

export const mockSubmissions: Submission[] = [
  {
    subId: 1,
    problemName: "prob-1",
    username: "alice",
    language: "cpp",
    submissionTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 30)),
    gradingTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 30)),
    gradingCompleteTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 29)),
    score: [10, 10, 10, 7, 7, 7, 7, 7, 7, 7], // per-testcase
    verdicts: ["AC", "AC", "AC", "AC", "AC", "AC", "AC", "AC", "AC", "AC"],
    times: [45, 42, 48, 50, 52, 49, 51, 47, 53, 46],
    memories: [4200, 4180, 4220, 4250, 4300, 4280, 4260, 4240, 4320, 4190],
    returnCodes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    status: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // all complete
    subtaskScores: [30, 70],
    totalScore: 100,
    maxTime: 53,
    maxMemory: 4320,
  },
  {
    subId: 2,
    problemName: "prob-1",
    username: "bob",
    language: "py",
    submissionTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 25)),
    gradingTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 25)),
    gradingCompleteTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 24)),
    score: [10, 10, 10, 7, 7, 0, 0, 0, 0, 0], // partial
    verdicts: ["AC", "AC", "AC", "AC", "AC", "WA", "WA", "WA", "WA", "WA"],
    times: [120, 115, 125, 130, 128, 122, 118, 124, 126, 119],
    memories: [8400, 8350, 8420, 8500, 8480, 8460, 8440, 8410, 8520, 8380],
    returnCodes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    status: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    subtaskScores: [30, 30], // partial subtask 2
    totalScore: 60,
    maxTime: 130,
    maxMemory: 8520,
  },
  {
    subId: 3,
    problemName: "prob-3",
    username: "alice",
    language: "cpp",
    submissionTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 20)),
    gradingTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 20)),
    gradingCompleteTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 19)),
    score: Array(20).fill(0).map((_, i) => i < 5 ? 6 : 0), // first 5 correct
    verdicts: Array(20).fill("").map((_, i) => i < 5 ? "AC" : "TLE"),
    times: Array(20).fill(0).map((_, i) => i < 5 ? 500 : 2500),
    memories: Array(20).fill(5100),
    returnCodes: Array(20).fill(0),
    status: Array(20).fill(2),
    subtaskScores: [30, 0, 0],
    totalScore: 30,
    maxTime: 2500,
    maxMemory: 5100,
  },
  {
    subId: 4,
    problemName: "prob-2",
    username: "charlie",
    language: "java",
    submissionTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 15)),
    gradingTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 15)),
    gradingCompleteTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 14)),
    score: Array(15).fill(100 / 15).map(Math.floor),
    verdicts: Array(15).fill("AC"),
    times: Array(15).fill(89),
    memories: Array(15).fill(42000),
    returnCodes: Array(15).fill(0),
    status: Array(15).fill(2),
    subtaskScores: [100],
    totalScore: 100,
    maxTime: 89,
    maxMemory: 42000,
  },
  {
    subId: 5,
    problemName: "prob-4",
    username: "alice",
    language: "cpp",
    submissionTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 2)),
    gradingTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 2)),
    gradingCompleteTime: "",
    score: Array(25).fill(0),
    verdicts: Array(25).fill(":("), // pending
    times: Array(25).fill(0),
    memories: Array(25).fill(0),
    returnCodes: Array(25).fill(0),
    status: Array(25).fill(1), // all pending
    subtaskScores: [0, 0, 0],
    totalScore: 0,
    maxTime: 0,
    maxMemory: 0,
  },
];

// =============================================================================
// ANNOUNCEMENTS
// =============================================================================

export const mockAnnouncements: Announcement[] = [
  {
    announcementId: "ann-1",
    title: "Welcome to Weekly Contest #42!",
    text: "The contest has started. Good luck to all participants! Remember to read the problem statements carefully.",
    announcementTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 60)),
    priority: "high",
    author: "admin",
  },
  {
    announcementId: "ann-2",
    title: "Clarification on Problem 3",
    text: "The input string will only contain lowercase English letters. Maximum length is 10^5.",
    announcementTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 30)),
    priority: "normal",
    author: "admin",
  },
  {
    announcementId: "ann-3",
    title: "15 minutes remaining",
    text: "The contest will end in 15 minutes. Make sure to submit your solutions before time runs out!",
    announcementTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 5)),
    priority: "high",
    author: "admin",
  },
];

// =============================================================================
// CLARIFICATIONS
// =============================================================================

export const mockClarifications: Clarification[] = [
  {
    askedBy: "alice",
    clarificationTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 45)),
    problemName: "prob-1",
    question: "Can the array contain duplicate values?",
    answer: "Yes, the array can contain duplicates, but the solution indices will be unique.",
    answeredBy: "admin",
  },
  {
    askedBy: "bob",
    clarificationTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 10)),
    problemName: "prob-3",
    question: "Is the empty string considered a valid substring?",
    answer: "",
    answeredBy: "",
  },
  {
    askedBy: "charlie",
    clarificationTime: formatDateTime(new Date(Date.now() - 1000 * 60 * 50)),
    problemName: "",
    question: "Is there a penalty for wrong submissions?",
    answer: "No penalty in this contest. Only your best score counts.",
    answeredBy: "admin",
  },
];

// =============================================================================
// SCOREBOARD (Computed View)
// =============================================================================

export interface ScoreboardEntry {
  rank: number;
  username: string;
  fullname: string;
  totalScore: number;
  totalTime: number; // in minutes
  problems: {
    problemName: string;
    score: number;
    maxScore: number;
    attempts: number;
    solvedAt: string | null; // datetime string or null
  }[];
}

export function getScoreboard(contestId: string): ScoreboardEntry[] {
  const contest = mockContests.find((c) => c.contestId === contestId);
  if (!contest) return [];

  const users = Object.keys(contest.users || {}).filter(
    (u) => contest.users?.[u] === "1"
  );

  const entries: ScoreboardEntry[] = users.map((username) => {
    const user = mockUsers.find((u) => u.username === username);
    const userScores = contest.scores?.[username] || {};

    const problems = contest.problems.map((problemName) => {
      const problem = mockProblems.find((p) => p.problemName === problemName);
      const score = userScores[problemName] || 0;
      const maxScore = problem ? getMaxScore(problem) : 100;
      const submissions = mockSubmissions.filter(
        (s) => s.username === username && s.problemName === problemName
      );
      const acSub = submissions.find((s) => s.totalScore === maxScore);

      return {
        problemName,
        score,
        maxScore,
        attempts: submissions.length,
        solvedAt: acSub ? acSub.submissionTime : null,
      };
    });

    const totalScore = problems.reduce((sum, p) => sum + p.score, 0);

    // Calculate total time (minutes since contest start for solved problems)
    const contestStart = parseDateTime(contest.startTime);
    const totalTime = problems.reduce((sum, p) => {
      if (!p.solvedAt) return sum;
      const solvedTime = parseDateTime(p.solvedAt);
      return sum + Math.floor((solvedTime.getTime() - contestStart.getTime()) / 60000);
    }, 0);

    return {
      rank: 0, // Will be set after sorting
      username,
      fullname: user?.fullname || username,
      totalScore,
      totalTime,
      problems,
    };
  });

  // Sort by score (desc), then by time (asc)
  entries.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    return a.totalTime - b.totalTime;
  });

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Get problems by contest
export function getProblemsForContest(contestId: string): Problem[] {
  const contest = mockContests.find((c) => c.contestId === contestId);
  if (!contest) return [];
  return mockProblems.filter((p) => contest.problems.includes(p.problemName));
}

// Get submissions for a user
export function getSubmissionsForUser(username: string): Submission[] {
  return mockSubmissions.filter((s) => s.username === username);
}

// Get active contest
export function getActiveContest(): Contest | null {
  return mockContests.find((c) => getContestStatus(c) === "ONGOING") || null;
}

// Get all contests with computed status
export function getContestsWithStatus(): (Contest & { status: ContestStatus })[] {
  return mockContests.map((c) => ({
    ...c,
    status: getContestStatus(c),
  }));
}

// Get a contest by ID
export function getContestById(contestId: string): Contest | null {
  return mockContests.find((c) => c.contestId === contestId) || null;
}

// Update a contest (mock - in real app this would be a DB call)
export function updateContest(
  contestId: string,
  updates: Partial<Contest>
): Contest | null {
  const index = mockContests.findIndex((c) => c.contestId === contestId);
  if (index === -1) return null;
  mockContests[index] = { ...mockContests[index], ...updates };
  return mockContests[index];
}

// Create a new contest
export function createContest(contestId: string): Contest {
  const newContest: Contest = {
    contestId,
    contestName: "New Contest",
    description: "",
    editorial: "",
    editorialVisible: false,
    startTime: "9999-12-31 23:59:59",
    endTime: "9999-12-31 23:59:59",
    duration: 180,
    mode: "centralized",
    problems: [],
    users: {},
    scores: {},
    subLimit: 50,
    subDelay: 60,
    public: false,
    publicScoreboard: false,
    createdAt: formatDateTime(new Date()),
  };
  mockContests.push(newContest);
  return newContest;
}

// Delete a contest
export function deleteContest(contestId: string): boolean {
  const index = mockContests.findIndex((c) => c.contestId === contestId);
  if (index === -1) return false;
  mockContests.splice(index, 1);
  return true;
}

// Get problem by ID
export function getProblemById(problemName: string): Problem | null {
  return mockProblems.find((p) => p.problemName === problemName) || null;
}

// Get submission by ID
export function getSubmissionById(subId: number): Submission | null {
  return mockSubmissions.find((s) => s.subId === subId) || null;
}

// Get user by username
export function getUserByUsername(username: string): MockUser | null {
  return mockUsers.find((u) => u.username === username) || null;
}

// Create a new submission
export function createSubmission(
  username: string,
  problemName: string,
  language: string
): Submission {
  const problem = getProblemById(problemName);
  const testcaseCount = problem?.testcaseCount || 10;

  const newSubmission: Submission = {
    subId: ++submissionCounter,
    username,
    problemName,
    language,
    submissionTime: formatDateTime(new Date()),
    gradingTime: "",
    gradingCompleteTime: "",
    score: Array(testcaseCount).fill(0),
    verdicts: Array(testcaseCount).fill(":("),
    times: Array(testcaseCount).fill(0),
    memories: Array(testcaseCount).fill(0),
    returnCodes: Array(testcaseCount).fill(0),
    status: Array(testcaseCount).fill(1), // pending
    subtaskScores: problem?.subtaskScores.map(() => 0) || [0],
    totalScore: 0,
    maxTime: 0,
    maxMemory: 0,
  };

  mockSubmissions.push(newSubmission);
  return newSubmission;
}

// Get clarifications for a user
export function getClarificationsForUser(username: string): Clarification[] {
  return mockClarifications.filter((c) => c.askedBy === username);
}

// Re-export utility functions
export { formatDateTime, parseDateTime, isDateTimeNotSet, getSubmissionVerdict, getMaxScore, getClarificationStatus };
