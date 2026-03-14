/**
 * Shared helpers for contest-specific routes to reduce duplication
 */

import { requireContestAccess } from "~/lib/auth.server";
import { getContest } from "~/lib/contest.server";
import type { SessionData } from "~/lib/session.server";
import type { Contest } from "~/types/database";

/**
 * Standard contest route data that all contest pages need
 */
export interface ContestRouteData {
  session: SessionData;
  contest: Contest;
  contestId: string;
}

/**
 * Shared loader logic for contest-specific routes
 * Handles auth, contest access, and provides common data
 */
export async function loadContestRoute(
  request: Request,
  contestId: string
): Promise<ContestRouteData> {
  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  return {
    session,
    contest,
    contestId,
  };
}