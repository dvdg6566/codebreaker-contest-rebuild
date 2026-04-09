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

