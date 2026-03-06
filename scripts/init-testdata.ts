#!/usr/bin/env bun
/**
 * Initialize Sample Test Data for Scoreboard Testing
 *
 * This script creates:
 * - Sample users (admin, alice, bob, charlie, diana)
 * - A test contest with problems
 * - Sample submissions demonstrating IOI-style subtask-max scoring
 *
 * IOI-style scoring example:
 * - Problem "addition" has subtasks: [0, 36, 64] (100 total)
 * - Alice submission 1: [0, 36, 0] = 36 points (got subtask 2)
 * - Alice submission 2: [0, 0, 64] = 64 points (got subtask 3)
 * - Alice's total for "addition": max(0,0) + max(36,0) + max(0,64) = 36 + 64 = 100
 *
 * Usage: bun run scripts/init-testdata.ts
 */

import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  GetItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// Configuration
const JUDGE_NAME = process.env.JUDGE_NAME || "codebreakercontest01";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

// AWS Client
const dynamodb = new DynamoDBClient({ region: REGION });

// Table names
const TABLES = {
  users: `${JUDGE_NAME}-users`,
  contests: `${JUDGE_NAME}-contests`,
  submissions: `${JUDGE_NAME}-submissions`,
  counters: `${JUDGE_NAME}-counters`,
};

// Helper: Format datetime
function formatDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

// Helper: Create or update item
async function putItem(tableName: string, item: Record<string, unknown>): Promise<void> {
  await dynamodb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );
}

// ============================================================================
// Sample Users
// ============================================================================
const USERS = [
  {
    username: "admin",
    role: "admin",
    fullname: "Admin User",
    email: "admin@example.com",
    label: "organizer",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
  {
    username: "alice",
    role: "member",
    fullname: "Alice Chen",
    email: "alice@example.com",
    label: "",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
  {
    username: "bob",
    role: "member",
    fullname: "Bob Smith",
    email: "bob@example.com",
    label: "",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
  {
    username: "charlie",
    role: "member",
    fullname: "Charlie Brown",
    email: "charlie@example.com",
    label: "",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
  {
    username: "diana",
    role: "member",
    fullname: "Diana Prince",
    email: "diana@example.com",
    label: "",
    contest: "contest-1",
    problemScores: {},
    problemSubmissions: {},
    latestSubmissions: {},
    latestScoreChange: "",
  },
];

// ============================================================================
// Sample Contest
// ============================================================================
const now = new Date();
const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // Started 2 hours ago
const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // Ends in 3 hours

const CONTEST = {
  contestId: "contest-1",
  contestName: "IOI Practice Round 2024",
  description: "Practice contest demonstrating IOI-style subtask scoring",
  problems: ["addition", "ping", "prisoners"],
  startTime: formatDateTime(startTime),
  endTime: formatDateTime(endTime),
  subLimit: 50,
  subDelay: 30,
  duration: 300, // 5 hours
  mode: "centralized",
  public: true,
  publicScoreboard: true,
  users: {
    admin: "1",
    alice: "1",
    bob: "1",
    charlie: "1",
    diana: "1",
  },
  // IOI-style scores: { username: { problemName: [subtask0Best, subtask1Best, ...] } }
  scores: {
    // Alice demonstrates IOI-style scoring:
    // - Submission 1 got subtasks [0, 36, 0], submission 2 got [0, 0, 64]
    // - Best per subtask: [0, 36, 64] = 100 total
    alice: {
      addition: [0, 36, 64], // Max of each subtask across submissions
      ping: [10, 30, 0],      // Got subtasks 1 and 2 (40 total)
      prisoners: [27, 0, 0, 0], // Got only subtask 1 (27 total)
    },
    // Bob got partial scores
    bob: {
      addition: [0, 36, 0],   // Only got subtask 2 (36 total)
      ping: [10, 0, 0],       // Only got subtask 1 (10 total)
    },
    // Charlie is in the lead
    charlie: {
      addition: [0, 36, 64],  // Full score (100)
      ping: [10, 30, 60],     // Full score (100)
      prisoners: [27, 29, 0, 0], // Got subtasks 1 and 2 (56 total)
    },
    // Diana just started, no submissions yet
    diana: {},
  },
};

// ============================================================================
// Sample Submissions
// ============================================================================
const SUBMISSIONS = [
  // Alice's submissions on "addition"
  {
    subId: 1,
    username: "alice",
    problemName: "addition",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 15 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 15 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 16 * 60 * 1000)),
    // Got subtask 2 only
    score: [100, 100, 100, 0], // per-testcase scores
    verdicts: ["AC", "AC", "AC", "WA"],
    times: [10, 12, 15, 20],
    memories: [1000, 1000, 1000, 1000],
    returnCodes: [0, 0, 0, 1],
    status: [2, 2, 2, 2], // all graded
    subtaskScores: [0, 36, 0], // Subtask results
    totalScore: 36,
    maxTime: 20,
    maxMemory: 1000,
  },
  {
    subId: 2,
    username: "alice",
    problemName: "addition",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 45 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 45 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 46 * 60 * 1000)),
    // Got subtask 3 only (different approach)
    score: [100, 0, 0, 100],
    verdicts: ["AC", "WA", "WA", "AC"],
    times: [10, 5, 5, 50],
    memories: [1000, 1000, 1000, 2000],
    returnCodes: [0, 1, 1, 0],
    status: [2, 2, 2, 2],
    subtaskScores: [0, 0, 64], // Got subtask 3 this time
    totalScore: 64,
    maxTime: 50,
    maxMemory: 2000,
  },
  // Bob's submission on "addition"
  {
    subId: 3,
    username: "bob",
    problemName: "addition",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 30 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 30 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 31 * 60 * 1000)),
    score: [100, 100, 100, 0],
    verdicts: ["AC", "AC", "AC", "WA"],
    times: [10, 12, 15, 20],
    memories: [1000, 1000, 1000, 1000],
    returnCodes: [0, 0, 0, 1],
    status: [2, 2, 2, 2],
    subtaskScores: [0, 36, 0],
    totalScore: 36,
    maxTime: 20,
    maxMemory: 1000,
  },
  // Charlie's submissions - gets full score
  {
    subId: 4,
    username: "charlie",
    problemName: "addition",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 20 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 20 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 21 * 60 * 1000)),
    score: [100, 100, 100, 100],
    verdicts: ["AC", "AC", "AC", "AC"],
    times: [10, 12, 15, 45],
    memories: [1000, 1000, 1000, 2000],
    returnCodes: [0, 0, 0, 0],
    status: [2, 2, 2, 2],
    subtaskScores: [0, 36, 64],
    totalScore: 100,
    maxTime: 45,
    maxMemory: 2000,
  },
  // Alice's submission on "ping"
  {
    subId: 5,
    username: "alice",
    problemName: "ping",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 60 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 60 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 61 * 60 * 1000)),
    score: Array(152).fill(100).map((_, i) => i < 73 ? 100 : 0), // First 73 pass
    verdicts: Array(152).fill("AC").map((_, i) => i < 73 ? "AC" : "WA"),
    times: Array(152).fill(10),
    memories: Array(152).fill(1000),
    returnCodes: Array(152).fill(0).map((_, i) => i < 73 ? 0 : 1),
    status: Array(152).fill(2),
    subtaskScores: [10, 30, 0], // Got subtasks 1 and 2
    totalScore: 40,
    maxTime: 10,
    maxMemory: 1000,
  },
  // Charlie's full score on "ping"
  {
    subId: 6,
    username: "charlie",
    problemName: "ping",
    language: "cpp",
    submissionTime: formatDateTime(new Date(startTime.getTime() + 90 * 60 * 1000)),
    gradingTime: formatDateTime(new Date(startTime.getTime() + 90 * 60 * 1000)),
    gradingCompleteTime: formatDateTime(new Date(startTime.getTime() + 91 * 60 * 1000)),
    score: Array(152).fill(100),
    verdicts: Array(152).fill("AC"),
    times: Array(152).fill(10),
    memories: Array(152).fill(1000),
    returnCodes: Array(152).fill(0),
    status: Array(152).fill(2),
    subtaskScores: [10, 30, 60],
    totalScore: 100,
    maxTime: 10,
    maxMemory: 1000,
  },
];

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  console.log("=== Initializing Scoreboard Test Data ===");
  console.log(`Judge Name: ${JUDGE_NAME}`);
  console.log(`Region: ${REGION}`);

  try {
    // Create users
    console.log("\n--- Creating Users ---");
    for (const user of USERS) {
      console.log(`  Creating user: ${user.username}`);
      await putItem(TABLES.users, user);
    }

    // Create contest
    console.log("\n--- Creating Contest ---");
    console.log(`  Creating contest: ${CONTEST.contestId}`);
    await putItem(TABLES.contests, CONTEST);

    // Create submissions
    console.log("\n--- Creating Submissions ---");
    for (const sub of SUBMISSIONS) {
      console.log(`  Creating submission #${sub.subId}: ${sub.username} on ${sub.problemName}`);
      await putItem(TABLES.submissions, sub);
    }

    // Update submission counter (optional - may not exist)
    console.log("\n--- Updating Counters ---");
    try {
      await putItem(TABLES.counters, {
        counterId: "submissionId",
        value: SUBMISSIONS.length + 1,
      });
      console.log("  Counter updated");
    } catch (error) {
      console.log("  Counters table not found (optional, skipping)");
    }

    console.log("\n=== Test Data Initialization Complete ===");

    // Validation
    console.log("\n--- Validating ---");
    let passed = 0;
    let failed = 0;

    async function check(label: string, fn: () => Promise<boolean>) {
      const ok = await fn();
      console.log(`  ${ok ? "✓" : "✗"} ${label}`);
      ok ? passed++ : failed++;
    }

    // Check each user exists
    for (const user of USERS) {
      await check(`User '${user.username}' in DynamoDB`, async () => {
        const res = await dynamodb.send(new GetItemCommand({
          TableName: TABLES.users,
          Key: { username: { S: user.username } },
        }));
        return !!res.Item;
      });
    }

    // Check contest exists
    await check(`Contest '${CONTEST.contestId}' in DynamoDB`, async () => {
      const res = await dynamodb.send(new GetItemCommand({
        TableName: TABLES.contests,
        Key: { contestId: { S: CONTEST.contestId } },
      }));
      return !!res.Item;
    });

    // Check submission count
    await check(`${SUBMISSIONS.length} submissions in DynamoDB`, async () => {
      const res = await dynamodb.send(new ScanCommand({
        TableName: TABLES.submissions,
        Select: "COUNT",
      }));
      return (res.Count ?? 0) >= SUBMISSIONS.length;
    });

    console.log(`\n  ${passed}/${passed + failed} checks passed`);
    if (failed > 0) {
      console.error(`  ${failed} check(s) failed — data may not have been written correctly`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

main();
