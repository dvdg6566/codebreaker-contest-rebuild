/**
 * Submissions Service
 *
 * High-level submission operations including contest validation and AWS integration
 */

import type { Submission } from "~/types/database";
import { createSubmissionWithSource, createCommunicationSubmission } from "./db/submissions.server";
import { isUserInActiveContest } from "./contest.server";
import { getProblem } from "./db/problems.server";

export interface SubmitSolutionParams {
  username: string;
  problemName: string;
  language: string;
  code?: string;
  codeA?: string;
  codeB?: string;
  contestId?: string;
}

/**
 * Submit a solution for grading
 */
export async function submitSolution(params: SubmitSolutionParams): Promise<Submission> {
  const { username, problemName, language, code, codeA, codeB, contestId } = params;

  // Validate problem exists
  const problem = await getProblem(problemName);
  if (!problem) {
    throw new Error("Problem not found");
  }

  if (!problem.validated) {
    throw new Error("Problem is not available for submissions");
  }

  // If contestId provided, validate contest access and status
  if (contestId) {
    const contestStatus = await isUserInActiveContest(username, contestId);
    if (!contestStatus.active) {
      throw new Error("Contest is not active or you don't have access");
    }

    if (!contestStatus.contest?.problems.includes(problemName)) {
      throw new Error("Problem is not part of this contest");
    }
  }

  // Validate language
  const supportedLanguages = ["cpp", "py", "java"];
  if (!supportedLanguages.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  // Handle Communication problems
  if (problem.problem_type === "Communication") {
    if (!codeA || !codeA.trim() || !codeB || !codeB.trim()) {
      throw new Error("Communication problems require both source files");
    }

    if (codeA.length > 1000000 || codeB.length > 1000000) {
      throw new Error("Code is too large");
    }

    const submission = await createCommunicationSubmission(
      username,
      problemName,
      language,
      codeA,
      codeB,
      contestId || "global",
      problem.testcaseCount
    );

    // Trigger grading via Step Function
    const { startGrading } = await import("./grading.server");
    await startGrading({
      problemName,
      submissionId: submission.subId,
      username,
      language,
      problemType: problem.problem_type,
      contestId: submission.contestId,
    });

    return submission;
  }

  // Handle regular problems (Batch/Interactive)
  if (!code || !code.trim()) {
    throw new Error("Code cannot be empty");
  }

  if (code.length > 1000000) {
    throw new Error("Code is too large");
  }

  const submission = await createSubmissionWithSource(
    username,
    problemName,
    language,
    code,
    contestId || "global",
    problem.testcaseCount
  );

  // Trigger grading via Step Function
  const { startGrading } = await import("./grading.server");
  await startGrading({
    problemName,
    submissionId: submission.subId,
    username,
    language,
    problemType: problem.problem_type,
    contestId: submission.contestId,
  });

  return submission;
}

/**
 * Get user's submission statistics for a problem
 */
export async function getSubmissionStats(username: string, problemName: string) {
  const { getSubmissionsByUserAndProblem } = await import("./db/submissions.server");
  const submissions = await getSubmissionsByUserAndProblem(username, problemName);

  const total = submissions.length;
  const accepted = submissions.filter(s => s.totalScore === 100).length;
  const pending = submissions.filter(s => !s.gradingCompleteTime).length;

  return {
    total,
    accepted,
    pending,
    bestScore: Math.max(0, ...submissions.map(s => s.totalScore || 0)),
  };
}
