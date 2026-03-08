/**
 * Grading Service
 *
 * Handles submission grading via AWS Step Functions.
 */

import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import { getLanguageExtension, isValidLanguage } from "./languages";
import { getProblem } from "./db/problems.server";
import {
  createSubmissionWithSource,
  createCommunicationSubmission,
  getSubmission,
} from "./db/submissions.server";

// Configuration
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
  accountId: process.env.AWS_ACCOUNT_ID || "",
};

// Step Function ARN
const STEP_FUNCTION_ARN = `arn:aws:states:${config.region}:${config.accountId}:stateMachine:${config.judgeName}-grading`;

// Create SFN client
const sfnClient = new SFNClient({
  region: config.region,
});

/**
 * Submission parameters
 */
export interface SubmissionParams {
  username: string;
  problemName: string;
  language: string;
  code: string;
  codeA?: string; // For Communication problems
  codeB?: string; // For Communication problems
}

/**
 * Submission result
 */
export interface SubmissionResult {
  success: boolean;
  subId?: number;
  error?: string;
}

/**
 * Submit code for grading
 */
export async function submitForGrading(
  params: SubmissionParams
): Promise<SubmissionResult> {
  const { username, problemName, language, code, codeA, codeB } = params;

  // Validate language
  if (!isValidLanguage(language)) {
    return { success: false, error: `Unsupported language: ${language}` };
  }

  // Validate problem exists and is validated
  const problem = await getProblem(problemName);
  if (!problem) {
    return { success: false, error: "Problem not found" };
  }

  if (!problem.validated) {
    return { success: false, error: "Problem is not ready for submissions" };
  }

  // Validate code length
  const maxCodeLength = 128000; // 128KB
  const codeLength = Math.max(
    code?.length || 0,
    codeA?.length || 0,
    codeB?.length || 0
  );

  if (codeLength > maxCodeLength) {
    return { success: false, error: "Code is too long (max 128KB)" };
  }

  if (codeLength === 0) {
    return { success: false, error: "Code cannot be empty" };
  }

  // Create submission based on problem type
  let submission;

  if (problem.problem_type === "Communication") {
    if (!codeA || !codeB) {
      return {
        success: false,
        error: "Communication problems require two source files",
      };
    }

    submission = await createCommunicationSubmission(
      username,
      problemName,
      language,
      codeA,
      codeB,
      problem.testcaseCount
    );
  } else {
    if (!code) {
      return { success: false, error: "Code is required" };
    }

    submission = await createSubmissionWithSource(
      username,
      problemName,
      language,
      code,
      problem.testcaseCount
    );
  }

  // Start grading via Step Function
  try {
    await startGrading({
      problemName,
      submissionId: submission.subId,
      username,
      language,
      problemType: problem.problem_type,
    });

    return { success: true, subId: submission.subId };
  } catch (error) {
    console.error("Failed to start grading:", error);
    return {
      success: false,
      subId: submission.subId,
      error: "Failed to start grading. Please try again.",
    };
  }
}

/**
 * Start grading via Step Function
 */
export async function startGrading(params: {
  problemName: string;
  submissionId: number;
  username: string;
  language: string;
  problemType: string;
  submissionTime?: string;
}): Promise<void> {
  const {
    problemName,
    submissionId,
    username,
    language,
    problemType,
    submissionTime,
  } = params;

  // Determine if grader is needed
  const grader = problemType !== "Batch";

  const input = {
    problemName,
    submissionId,
    username,
    submissionTime:
      submissionTime || new Date().toISOString().replace("T", " ").slice(0, 19),
    language,
    grader,
    problemType,
  };

  console.log("Starting Step Function:", JSON.stringify(input));

  await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: STEP_FUNCTION_ARN,
      name: `sub-${submissionId}-${Date.now()}`,
      input: JSON.stringify(input),
    })
  );
}

/**
 * Regrade a specific submission
 */
export async function regradeSubmission(subId: number): Promise<boolean> {
  const submission = await getSubmission(subId);
  if (!submission) {
    return false;
  }

  const problem = await getProblem(submission.problemName);
  if (!problem) {
    return false;
  }

  await startGrading({
    problemName: submission.problemName,
    submissionId: subId,
    username: submission.username,
    language: submission.language,
    problemType: problem.problem_type,
    submissionTime: submission.submissionTime,
  });

  return true;
}

/**
 * Regrade all submissions for a problem
 */
export async function regradeProblem(
  problemName: string,
  regradeType: "NORMAL" | "AC" | "NONZERO" = "NORMAL"
): Promise<{ count: number }> {
  const { getSubmissionsByProblem } = await import("./db/submissions.server");

  const submissions = await getSubmissionsByProblem(problemName);
  let filtered = submissions;

  // Filter by regrade type
  switch (regradeType) {
    case "AC":
      filtered = submissions.filter((s) => s.totalScore === 100);
      break;
    case "NONZERO":
      filtered = submissions.filter((s) => s.totalScore > 0);
      break;
    default:
      // NORMAL - all submissions
      break;
  }

  // Start regrading
  for (const submission of filtered) {
    await regradeSubmission(submission.subId);
  }

  return { count: filtered.length };
}

/**
 * Check grading execution status
 */
export async function checkGradingStatus(
  subId: number
): Promise<{
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  output?: Record<string, unknown>;
}> {
  const submission = await getSubmission(subId);
  if (!submission) {
    return { status: "UNKNOWN" };
  }

  // Use gradingCompleteTime as the authoritative done signal
  if (submission.gradingCompleteTime) {
    return submission.compileErrorMessage
      ? { status: "FAILED" }
      : { status: "SUCCEEDED" };
  }

  return { status: "RUNNING" };
}

/**
 * Compile a custom checker
 */
export async function compileChecker(
  problemName: string
): Promise<{ success: boolean; error?: string }> {
  const { LambdaClient, InvokeCommand } = await import(
    "@aws-sdk/client-lambda"
  );

  const lambdaClient = new LambdaClient({ region: config.region });
  const compilerArn = `arn:aws:lambda:${config.region}:${config.accountId}:function:${config.judgeName}-compiler`;

  const input = {
    problemName,
    eventType: "CHECKER",
  };

  try {
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: compilerArn,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(input),
      })
    );

    const result = JSON.parse(
      new TextDecoder().decode(response.Payload)
    );

    if (result.status === 200) {
      return { success: true };
    } else {
      return { success: false, error: result.error || "Compilation failed" };
    }
  } catch (error) {
    console.error("Checker compilation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { config };
