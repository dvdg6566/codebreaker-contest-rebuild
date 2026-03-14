/**
 * Scoreboard Service
 *
 * Computes scoreboard data from contests, users, problems, and submissions.
 */

import type { Contest, Problem, Submission, User } from "~/types/database";
import { parseDateTime, getMaxScore } from "~/types/database";
import { getContest, calculateProblemScore } from "./contests.server";
import { listUsers, getUser } from "./users.server";
import { getProblem } from "./problems.server";
import { getSubmissionsByUser } from "./submissions.server";

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
    solvedAt: string | null;
  }[];
}

/**
 * Get scoreboard for a contest
 */
export async function getScoreboard(contestId: string): Promise<ScoreboardEntry[]> {
  const contest = await getContest(contestId);
  if (!contest) return [];

  // Get all users and find those who have started this contest
  const allUsers = await listUsers();
  const users = allUsers
    .filter(user =>
      user.activeContests?.[contestId]?.status === "started"
    )
    .map(user => user.username);

  // Get problem data
  const problemsData: Problem[] = [];
  for (const problemName of contest.problems) {
    const problem = await getProblem(problemName);
    if (problem) problemsData.push(problem);
  }

  // Build entries
  const entries: ScoreboardEntry[] = [];

  for (const username of users) {
    const user = await getUser(username);
    if (!user) continue;

    // Get user's contest-specific scores
    const userScores = user.contestScores?.[contestId] || {};
    const userSubmissions = await getSubmissionsByUser(username);

    const problems = contest.problems.map((problemName) => {
      const problem = problemsData.find((p) => p.problemName === problemName);
      // userScores[problemName] is the total score for this problem
      const score = userScores[problemName] || 0;
      const maxScore = problem ? getMaxScore(problem) : 100;

      const problemSubmissions = userSubmissions.filter(
        (s) => s.problemName === problemName
      );
      const acSub = problemSubmissions.find((s) => s.totalScore === maxScore);

      return {
        problemName,
        score,
        maxScore,
        attempts: problemSubmissions.length,
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

    entries.push({
      rank: 0,
      username,
      fullname: user?.fullname || username,
      totalScore,
      totalTime,
      problems,
    });
  }

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
