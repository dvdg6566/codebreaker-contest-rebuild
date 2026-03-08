/**
 * Contest service for managing contest state and user participation
 */

import type { Contest, ContestMode, ContestStatus } from "~/types/database";
import { parseDateTime, isDateTimeNotSet } from "~/types/database";
import {
  getContest as dbGetContest,
  getContestStatus,
  updateContest as dbUpdateContest,
} from "./db/index.server";
import { getUser } from "./db/index.server";

// Re-export types
export type { ContestMode, ContestStatus };
export type { Contest };

export interface UserParticipation {
  username: string;
  contestId: string;
  startedAt: Date | null;
  endsAt: Date | null;
}

// Track user participations (in-memory cache)
const userParticipations: Map<string, UserParticipation> = new Map();

/**
 * Get the contest assigned to a user
 */
export async function getUserAssignedContest(username: string): Promise<Contest | null> {
  const user = await getUser(username);
  if (!user?.contest) return null;
  return dbGetContest(user.contest);
}

/**
 * Get the current active contest for a user (if any)
 */
export async function getActiveContest(username: string): Promise<Contest | null> {
  const contest = await getUserAssignedContest(username);
  if (!contest) return null;

  const status = getContestStatus(contest);
  if (status === "ONGOING") {
    return contest;
  }

  // For self-timer mode, also return the contest if it's within the window
  if (contest.mode === "self-timer" && status !== "ENDED") {
    return contest;
  }

  return null;
}

/**
 * Get a specific contest by ID
 */
export async function getContest(contestId: string): Promise<Contest | null> {
  return dbGetContest(contestId);
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
export async function startUserContest(
  username: string,
  contestId: string
): Promise<UserParticipation> {
  const contest = await dbGetContest(contestId);
  if (!contest) {
    throw new Error("Contest not found");
  }

  // SECURITY: Verify user has access to this contest
  const userInContest = contest.users?.[username];
  if (!userInContest) {
    throw new Error("Access denied: You are not assigned to this contest");
  }

  // SECURITY: Verify user hasn't already started (only invited users can start)
  if (userInContest && userInContest !== "0") {
    throw new Error("You have already started this contest");
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
    await dbUpdateContest(contestId, {
      users: { ...contest.users, [username]: "1" },
    });
  }

  return participation;
}

/**
 * Check if a user is currently in an active contest session
 */
export async function isUserInActiveContest(username: string): Promise<{
  active: boolean;
  contest: Contest | null;
  participation: UserParticipation | null;
  timeRemaining: number;
  contestStart: Date | null;
  contestEnd: Date | null;
}> {
  const now = new Date();
  const contest = await getUserAssignedContest(username);

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
    return {
      active: false,
      contest,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  } else {
    // Self-timer mode
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
      return {
        active: false,
        contest,
        participation,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null,
      };
    } else {
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
export async function getContestProblems(username: string): Promise<string[]> {
  const status = await isUserInActiveContest(username);
  if (!status.active || !status.contest) {
    return [];
  }
  return status.contest.problems;
}
