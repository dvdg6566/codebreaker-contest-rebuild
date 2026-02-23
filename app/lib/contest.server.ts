/**
 * Contest service for managing contest state and user participation
 */

import type { Contest, ContestMode, ContestStatus } from "~/types/database";
import { parseDateTime, isDateTimeNotSet } from "~/types/database";
import {
  mockContests,
  getContestById,
  getContestStatus,
  updateContest,
} from "./mock-data";

// Re-export types
export type { ContestMode, ContestStatus };
export type { Contest };

export interface UserParticipation {
  username: string;
  contestId: string;
  // For self-timer: when the user started their contest
  startedAt: Date | null;
  // Calculated end time for self-timer
  endsAt: Date | null;
}

// Track user participations (in-memory for mock)
const userParticipations: Map<string, UserParticipation> = new Map();

// Configuration: set which contest is currently "active" for the UI
// This simulates which contest a user is assigned to
// In production, this would be looked up from the user's record
const USER_CONTEST_ASSIGNMENTS: Record<string, string> = {
  alice: "contest-1",
  bob: "contest-1",
  charlie: "contest-1",
  admin: "contest-1",
};

/**
 * Get the contest assigned to a user
 */
export function getUserAssignedContest(username: string): Contest | null {
  const contestId = USER_CONTEST_ASSIGNMENTS[username];
  if (!contestId) return null;
  return getContestById(contestId);
}

/**
 * Get the current active contest for a user (if any)
 */
export function getActiveContest(username: string): Contest | null {
  const contest = getUserAssignedContest(username);
  if (!contest) return null;

  const status = getContestStatus(contest);
  if (status === "ONGOING") {
    return contest;
  }

  // For self-timer mode, also return the contest if it's within the window
  // so users can start it
  if (contest.mode === "self-timer" && status !== "ENDED") {
    return contest;
  }

  return null;
}

/**
 * Get all available contests
 */
export function getAllContests(): Contest[] {
  return mockContests;
}

/**
 * Get a specific contest by ID
 */
export function getContest(contestId: string): Contest | null {
  return getContestById(contestId);
}

/**
 * Get user's participation in a contest
 */
export function getUserParticipation(
  username: string,
  contestId: string
): UserParticipation | null {
  const key = `${username}:${contestId}`;
  return userParticipations.get(key) || null;
}

/**
 * Start a user's contest (for self-timer mode)
 */
export function startUserContest(
  username: string,
  contestId: string
): UserParticipation {
  const contest = getContestById(contestId);
  if (!contest) {
    throw new Error("Contest not found");
  }

  if (contest.mode !== "self-timer") {
    throw new Error("This contest uses centralized timing");
  }

  const now = new Date();
  const status = getContestStatus(contest);

  if (status === "NOT_STARTED") {
    throw new Error("Contest has not started yet");
  }

  if (status === "ENDED") {
    throw new Error("Contest has ended");
  }

  const key = `${username}:${contestId}`;
  const existing = userParticipations.get(key);
  if (existing?.startedAt) {
    throw new Error("You have already started this contest");
  }

  const duration = contest.duration || 180;
  const participation: UserParticipation = {
    username,
    contestId,
    startedAt: now,
    endsAt: new Date(now.getTime() + duration * 60 * 1000),
  };

  userParticipations.set(key, participation);

  // Also mark the user as started in the contest
  if (contest.users?.[username] === "0") {
    updateContest(contestId, {
      users: { ...contest.users, [username]: "1" },
    });
  }

  return participation;
}

/**
 * Check if a user is currently in an active contest session
 */
export function isUserInActiveContest(username: string): {
  active: boolean;
  contest: Contest | null;
  participation: UserParticipation | null;
  timeRemaining: number; // in seconds
  contestStart: Date | null;
  contestEnd: Date | null;
} {
  const now = new Date();
  const contest = getUserAssignedContest(username);

  if (!contest) {
    return {
      active: false,
      contest: null,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  }

  const status = getContestStatus(contest);

  if (contest.mode === "centralized") {
    // Centralized: everyone is in the contest during the window
    if (status === "ONGOING") {
      const endTime = isDateTimeNotSet(contest.endTime)
        ? new Date("9999-12-31")
        : parseDateTime(contest.endTime);
      const timeRemaining = Math.max(
        0,
        Math.floor((endTime.getTime() - now.getTime()) / 1000)
      );
      return {
        active: true,
        contest,
        participation: null,
        timeRemaining,
        contestStart: parseDateTime(contest.startTime),
        contestEnd: isDateTimeNotSet(contest.endTime)
          ? null
          : parseDateTime(contest.endTime),
      };
    }
    // Contest not active
    return {
      active: false,
      contest,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  } else {
    // Self-timer: check if user has started and is still within their time
    const participation = getUserParticipation(username, contest.contestId);

    if (participation?.startedAt && participation.endsAt) {
      if (now <= participation.endsAt) {
        const timeRemaining = Math.max(
          0,
          Math.floor((participation.endsAt.getTime() - now.getTime()) / 1000)
        );
        return {
          active: true,
          contest,
          participation,
          timeRemaining,
          contestStart: participation.startedAt,
          contestEnd: participation.endsAt,
        };
      }
      // User's time has expired
      return {
        active: false,
        contest,
        participation,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null,
      };
    } else {
      // User hasn't started yet - contest is available but not active
      // Return the contest so they can start it
      return {
        active: false,
        contest,
        participation: null,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null,
      };
    }
  }
}

/**
 * Get contest problems (only if user is in active contest)
 */
export function getContestProblems(username: string): string[] {
  const status = isUserInActiveContest(username);
  if (!status.active || !status.contest) {
    return [];
  }
  return status.contest.problems;
}
