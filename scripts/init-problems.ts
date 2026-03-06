#!/usr/bin/env bun
/**
 * Initialize Sample Problems
 *
 * This script creates sample problems (addition, ping, prisoners) and uploads
 * their files to S3 for testing the judge system.
 *
 * Usage: bun run scripts/init-problems.ts
 */

import { readdir, readFile } from "fs/promises";
import { join, basename, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { marshall } from "@aws-sdk/util-dynamodb";

// Configuration
const JUDGE_NAME = process.env.JUDGE_NAME || "codebreakercontest01";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

// AWS Clients
const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

// Bucket names
const BUCKETS = {
  statements: `${JUDGE_NAME}-statements`,
  testdata: `${JUDGE_NAME}-testdata`,
  checkers: `${JUDGE_NAME}-checkers`,
  graders: `${JUDGE_NAME}-graders`,
  attachments: `${JUDGE_NAME}-attachments`,
};

// Table names
const TABLES = {
  problems: `${JUDGE_NAME}-problems`,
  users: `${JUDGE_NAME}-users`,
};

// Helper: Upload file to S3
async function uploadFile(
  bucket: string,
  key: string,
  content: Buffer,
  contentType?: string
): Promise<void> {
  console.log(`  Uploading ${bucket}/${key}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    })
  );
}

// Helper: Upload folder contents to S3
async function uploadFolder(
  localPath: string,
  bucket: string,
  s3Prefix: string
): Promise<number> {
  const files = await readdir(localPath);
  let count = 0;

  for (const file of files) {
    const filePath = join(localPath, file);
    const content = await readFile(filePath);
    const s3Key = `${s3Prefix}/${file}`;
    await uploadFile(bucket, s3Key, content, "text/plain");
    count++;
  }

  return count;
}

// Helper: Create/update problem in DynamoDB
async function createProblem(problemName: string): Promise<void> {
  const item = {
    problemName,
    title: problemName,
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

  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLES.problems,
      Item: marshall(item),
    })
  );
}

// Helper: Update problem info
async function updateProblem(
  problemName: string,
  updates: Record<string, unknown>
): Promise<void> {
  const updateParts: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateParts.push(`${attrName} = ${attrValue}`);
    expressionNames[attrName] = key;
    expressionValues[attrValue] = value;
  });

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: TABLES.problems,
      Key: marshall({ problemName }),
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: marshall(expressionValues),
    })
  );
}

// ============================================================================
// Problem: addition (Batch problem)
// ============================================================================
async function createAddition(): Promise<void> {
  const problemName = "addition";
  const problemDir = join(__dirname, "init/problems/addition");

  console.log("\n=== Creating problem: addition ===");

  // Create problem record
  console.log("Creating problem record...");
  await createProblem(problemName);

  // Upload statement
  console.log("Uploading statement...");
  const statement = await readFile(join(problemDir, "statement.html"));
  await uploadFile(
    BUCKETS.statements,
    `${problemName}.html`,
    statement,
    "text/html"
  );

  // Upload testdata
  console.log("Uploading testdata...");
  const testdataDir = join(problemDir, "testdata");
  const testCount = await uploadFolder(testdataDir, BUCKETS.testdata, problemName);
  console.log(`  Uploaded ${testCount / 2} testcases`);

  // Update subtasks
  console.log("Updating subtasks...");
  await updateProblem(problemName, {
    testcaseCount: testCount / 2,
    subtaskScores: [0, 36, 64],
    subtaskDependency: ["1", "1-3", "1-4"],
    validated: true,
  });

  console.log("Problem 'addition' created successfully!");
}

// ============================================================================
// Problem: ping (Interactive problem)
// ============================================================================
async function createPing(): Promise<void> {
  const problemName = "ping";
  const problemDir = join(__dirname, "init/problems/ping");

  console.log("\n=== Creating problem: ping ===");

  // Create problem record
  console.log("Creating problem record...");
  await createProblem(problemName);

  // Upload statement (PDF)
  console.log("Uploading statement...");
  const statement = await readFile(join(problemDir, "statement.pdf"));
  await uploadFile(
    BUCKETS.statements,
    `${problemName}.pdf`,
    statement,
    "application/pdf"
  );

  // Upload attachments
  console.log("Uploading attachments...");
  const attachments = await readFile(join(problemDir, "attachments.zip"));
  await uploadFile(
    BUCKETS.attachments,
    `${problemName}.zip`,
    attachments,
    "application/zip"
  );

  // Upload checker
  console.log("Uploading checker...");
  const checker = await readFile(join(problemDir, "checker.cpp"));
  await uploadFile(
    BUCKETS.checkers,
    `source/${problemName}.cpp`,
    checker,
    "text/x-c++src"
  );
  await compileChecker(problemName);

  // Upload grader
  console.log("Uploading grader...");
  const grader = await readFile(join(problemDir, "grader.cpp"));
  await uploadFile(
    BUCKETS.graders,
    `${problemName}/grader.cpp`,
    grader,
    "text/x-c++src"
  );

  // Upload header
  const header = await readFile(join(problemDir, "ping.h"));
  await uploadFile(
    BUCKETS.graders,
    `${problemName}/ping.h`,
    header,
    "text/x-c"
  );

  // Upload testdata
  console.log("Uploading testdata...");
  const testdataDir = join(problemDir, "testdata");
  const files = await readdir(testdataDir);
  const testCount = files.length;

  for (const file of files) {
    const content = await readFile(join(testdataDir, file));
    await uploadFile(BUCKETS.testdata, `${problemName}/${file}`, content);
  }
  console.log(`  Uploaded ${testCount / 2} testcases`);

  // Update problem info
  console.log("Updating problem info...");
  await updateProblem(problemName, {
    testcaseCount: testCount / 2,
    problem_type: "Interactive",
    customChecker: true,
    attachments: true,
    subtaskScores: [10, 30, 60],
    subtaskDependency: ["1-20", "1-73", "74-152"],
    validated: true,
  });

  console.log("Problem 'ping' created successfully!");
}

// ============================================================================
// Problem: prisoners (Communication problem)
// ============================================================================
async function createPrisoners(): Promise<void> {
  const problemName = "prisoners";
  const problemDir = join(__dirname, "init/problems/prisoners");

  console.log("\n=== Creating problem: prisoners ===");

  // Create problem record
  console.log("Creating problem record...");
  await createProblem(problemName);

  // Upload statement (PDF)
  console.log("Uploading statement...");
  const statement = await readFile(join(problemDir, "statement.pdf"));
  await uploadFile(
    BUCKETS.statements,
    `${problemName}.pdf`,
    statement,
    "application/pdf"
  );

  // Upload attachments
  console.log("Uploading attachments...");
  const attachments = await readFile(join(problemDir, "attachments.zip"));
  await uploadFile(
    BUCKETS.attachments,
    `${problemName}.zip`,
    attachments,
    "application/zip"
  );

  // Upload checker
  console.log("Uploading checker...");
  const checker = await readFile(join(problemDir, "checker.cpp"));
  await uploadFile(
    BUCKETS.checkers,
    `source/${problemName}.cpp`,
    checker,
    "text/x-c++src"
  );
  await compileChecker(problemName);

  // Upload grader
  console.log("Uploading grader...");
  const grader = await readFile(join(problemDir, "grader.cpp"));
  await uploadFile(
    BUCKETS.graders,
    `${problemName}/grader.cpp`,
    grader,
    "text/x-c++src"
  );

  // Upload headers
  const prisonerHeader = await readFile(join(problemDir, "prisoner.h"));
  await uploadFile(
    BUCKETS.graders,
    `${problemName}/prisoner.h`,
    prisonerHeader,
    "text/x-c"
  );

  const swapperHeader = await readFile(join(problemDir, "swapper.h"));
  await uploadFile(
    BUCKETS.graders,
    `${problemName}/swapper.h`,
    swapperHeader,
    "text/x-c"
  );

  // Upload testdata
  console.log("Uploading testdata...");
  const testdataDir = join(problemDir, "testdata");
  const files = await readdir(testdataDir);
  const testCount = files.length;

  for (const file of files) {
    const content = await readFile(join(testdataDir, file));
    await uploadFile(BUCKETS.testdata, `${problemName}/${file}`, content);
  }
  console.log(`  Uploaded ${testCount / 2} testcases`);

  // Update problem info
  console.log("Updating problem info...");
  await updateProblem(problemName, {
    testcaseCount: testCount / 2,
    problem_type: "Communication",
    customChecker: true,
    attachments: true,
    nameA: "swapper",
    nameB: "prisoner",
    subtaskScores: [27, 29, 44, 0],
    subtaskDependency: ["1-10", "11-20", "1-30", "31"],
    validated: true,
  });

  console.log("Problem 'prisoners' created successfully!");
}

// Helper: Compile checker via Lambda
async function compileChecker(problemName: string): Promise<void> {
  const compilerArn = `arn:aws:lambda:${REGION}:${process.env.AWS_ACCOUNT_ID}:function:${JUDGE_NAME}-compiler`;
  console.log("  Compiling checker...");

  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: compilerArn,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ problemName, eventType: "CHECKER" }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  if (result.status === 200) {
    console.log("  Checker compiled successfully!");
  } else {
    throw new Error(`Checker compilation failed: ${result.error || "Unknown error"}`);
  }
}

// ============================================================================
// Validate problem via Lambda
// ============================================================================
async function validateProblem(problemName: string): Promise<void> {
  const functionArn = `arn:aws:lambda:${REGION}:${process.env.AWS_ACCOUNT_ID}:function:${JUDGE_NAME}-problem-validation`;

  console.log(`\nValidating problem '${problemName}'...`);

  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: functionArn,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ problemName }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  const verdicts: Record<string, number> = result.verdicts ?? {};
  const remarks: Record<string, string> = result.remarks ?? {};

  for (const [key, verdict] of Object.entries(verdicts)) {
    const icon = verdict === 1 ? "✓" : "✗";
    const remark = remarks[key] ? ` — ${remarks[key]}` : "";
    console.log(`  ${icon} ${key}${remark}`);
  }

  const validated = Object.values(verdicts).every((v) => v === 1);
  console.log(`  ${validated ? "Problem validated!" : "Validation failed."}`);
}

// ============================================================================
// Check Cognito users
// ============================================================================
async function checkCognitoUsers(): Promise<void> {
  console.log("\n=== Cognito Users ===");
  console.log("Note: Run 'bun run init:users' to create test users in Cognito.");
  console.log("      Default credentials: admin / P@55w0rd");
}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  console.log("=== Codebreaker Contest Judge Initialization ===");
  console.log(`Judge Name: ${JUDGE_NAME}`);
  console.log(`Region: ${REGION}`);

  try {
    await checkCognitoUsers();
    await createAddition();
    await createPing();
    await createPrisoners();

    console.log("\n=== Validating Problems ===");
    await validateProblem("addition");
    await validateProblem("ping");
    await validateProblem("prisoners");

    console.log("\n=== Initialization Complete ===");
    console.log("\nNext steps:");
    console.log("1. Run 'bun run init:users' to create Cognito users (if not already done)");
    console.log("2. Run 'bun run init:testdata' to create test contest data");
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

main();
