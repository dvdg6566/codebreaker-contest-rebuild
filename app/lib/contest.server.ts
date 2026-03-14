/**
 * Contest service for managing contest state and user participation
 */

import type { Contest, ContestMode, ContestStatus } from "~/types/database";
import { parseDateTime, isDateTimeNotSet, formatDateTime } from "~/types/database";
import { scheduleUserContestEnd } from "./scheduler.server";
import {
  getContest as dbGetContest,
  getContestStatus,
  updateContest as dbUpdateContest,
} from "./db/index.server";
import {
  getUserActiveContests as dbGetUserActiveContests,
  canUserAccessContest as dbCanUserAccessContest,
} from "./db/index.server";

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
 * Get a specific contest by ID
 */
export async function getContest(contestId: string): Promise<Contest | null> {
  return dbGetContest(contestId);
}

/**
 * Get user's participation in a contest (in-memory tracking for self-timer)
 */
export function getUserParticipation(
  username: string,
  contestId: string
): UserParticipation | null {
  const key = `${username}:${contestId}`;
  return userParticipations.get(key) || null;
}

// =============================================================================
// MULTI-CONTEST FUNCTIONS
// =============================================================================

/**
 * Get all active contests for a user
 */
export async function getUserActiveContests(username: string): Promise<Contest[]> {
  const activeContests = await dbGetUserActiveContests(username);
  const contestIds = Object.keys(activeContests);

  const contests = await Promise.all(
    contestIds.map(contestId => dbGetContest(contestId))
  );

  return contests.filter(Boolean) as Contest[];
}

/**
 * Check if user can access specific contest
 */
export async function canUserAccessContest(
  username: string,
  contestId: string
): Promise<boolean> {
  return dbCanUserAccessContest(username, contestId);
}

/**
 * Start user's contest (for self-timer mode)
 */
export async function startUserContest(
  username: string,
  contestId: string
): Promise<UserParticipation> {
  const contest = await dbGetContest(contestId);
  if (!contest) {
    throw new Error("Contest not found");
  }

  // Check user has access to this contest
  const hasAccess = await canUserAccessContest(username, contestId);
  if (!hasAccess) {
    throw new Error("Access denied: You are not assigned to this contest");
  }

  // Get user's current participation in this contest
  const activeContests = await dbGetUserActiveContests(username);
  const participation = activeContests[contestId];

  if (!participation) {
    throw new Error("You are not assigned to this contest");
  }

  if (participation.status !== "invited") {
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

  const duration = contest.duration || 180;
  const userParticipation: UserParticipation = {
    username,
    contestId,
    startedAt: now,
    endsAt: new Date(now.getTime() + duration * 60 * 1000),
  };

  // Update user's contest status to started
  const { updateUserContestStatus } = await import("./db/index.server");
  await updateUserContestStatus(username, contestId, {
    status: "started",
    startedAt: formatDateTime(now),
  });

  // Also mark user as started in the contest
  if (contest.users?.[username] === "0") {
    await dbUpdateContest(contestId, {
      users: { ...contest.users, [username]: "1" },
    });
  }

  // Store participation in memory (existing pattern)
  const key = `${username}:${contestId}`;
  userParticipations.set(key, userParticipation);

  // Schedule end notification
  await scheduleUserContestEnd(contestId, username, userParticipation.endsAt!);

  return userParticipation;
}

/**
 * Check if user is in an active contest session for specific contest
 */
export async function isUserInActiveContest(
  username: string,
  contestId: string
): Promise<{
  active: boolean;
  contest: Contest | null;
  participation: UserParticipation | null;
  timeRemaining: number;
  contestStart: Date | null;
  contestEnd: Date | null;
}> {
  const now = new Date();

  // Check if user has access to this contest
  const hasAccess = await canUserAccessContest(username, contestId);
  if (!hasAccess) {
    return {
      active: false,
      contest: null,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  }

  const contest = await dbGetContest(contestId);
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
  const activeContests = await dbGetUserActiveContests(username);
  const userParticipation = activeContests[contestId];

  // Handle different user participation states
  if (!userParticipation) {
    return {
      active: false,
      contest,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  }

  // For invited users in centralized contests, they can view during ongoing status
  if (userParticipation.status === "invited" && contest.mode === "centralized" && status === "ONGOING") {
    const endTime = isDateTimeNotSet(contest.endTime)
      ? new Date("9999-12-31")
      : parseDateTime(contest.endTime);
    const timeRemaining = Math.max(
      0,
      Math.floor((endTime.getTime() - now.getTime()) / 1000)
    );
    return {
      active: true, // They can view the contest
      contest,
      participation: null,
      timeRemaining,
      contestStart: parseDateTime(contest.startTime),
      contestEnd: isDateTimeNotSet(contest.endTime) ? null : parseDateTime(contest.endTime),
    };
  }

  // For non-started users (invited but not started), return inactive
  if (userParticipation.status !== "started") {
    return {
      active: false,
      contest,
      participation: null,
      timeRemaining: 0,
      contestStart: null,
      contestEnd: null,
    };
  }

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
  } else {
    // Self-timer mode - check in-memory participation
    const memoryParticipation = getUserParticipation(username, contestId);

    if (memoryParticipation?.startedAt && memoryParticipation.endsAt) {
      if (now <= memoryParticipation.endsAt) {
        const timeRemaining = Math.max(
          0,
          Math.floor((memoryParticipation.endsAt.getTime() - now.getTime()) / 1000)
        );
        return {
          active: true,
          contest,
          participation: memoryParticipation,
          timeRemaining,
          contestStart: memoryParticipation.startedAt,
          contestEnd: memoryParticipation.endsAt,
        };
      }
    }
  }

  return {
    active: false,
    contest,
    participation: null,
    timeRemaining: 0,
    contestStart: null,
    contestEnd: null,
  };
}

/**
 * Get contest problems for a specific contest (if user has access)
 */
export async function getContestProblems(
  username: string,
  contestId: string
): Promise<string[]> {
  const status = await isUserInActiveContest(username, contestId);
  if (!status.active || !status.contest) {
    return [];
  }
  return status.contest.problems;
}
