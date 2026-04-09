import type { Route } from "./+types/contests";
import { Link, Form } from "react-router";
import {
  Clock,
  Calendar,
  Trophy,
  Users,
  Play,
  Eye,
  Timer,
  Globe,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { StatusBadge } from "~/components/ui/status-badge";
import type { UserContestView, ContestStatus, UserContestStatus } from "~/types/database";
import { formatDateTimeWithFallback } from "~/lib/datetime-utils";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { getUserContests } = await import("~/lib/db/contests.server");

  const session = await requireAuth(request);
  const userContests = await getUserContests(session.username);

  return {
    contests: userContests,
    username: session.username,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { startUserContest } = await import("~/lib/contest.server");
  const { getUserContests } = await import("~/lib/db/contests.server");

  const session = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const contestId = formData.get("contestId") as string;

  if (intent === "start_contest" && contestId) {
    // SECURITY: Double-check user has access to this contest
    const userContests = await getUserContests(session.username);
    const allowedContest = userContests.find(c =>
      c.contestId === contestId && c.canStart
    );

    if (!allowedContest) {
      return {
        error: "Access denied: You cannot start this contest"
      };
    }

    try {
      await startUserContest(session.username, contestId);
      return { success: true, message: "Contest started successfully!" };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to start contest"
      };
    }
  }

  if (intent === "start_centralized_contest" && contestId) {
    // SECURITY: Double-check user has access to this contest
    const userContests = await getUserContests(session.username);
    const allowedContest = userContests.find(c =>
      c.contestId === contestId &&
      c.status === "ONGOING" &&
      c.mode === "centralized" &&
      c.userStatus === "invited"
    );

    if (!allowedContest) {
      return {
        error: "Access denied: You cannot start this contest"
      };
    }

    try {
      const { updateUserContestStatus } = await import("~/lib/db/users.server");
      const { updateContest } = await import("~/lib/db/contests.server");
      const { formatDateTime } = await import("~/types/database");
      const { getContest } = await import("~/lib/contest.server");

      // Mark user as started for centralized contest (new system)
      await updateUserContestStatus(session.username, contestId, {
        status: "started",
        startedAt: formatDateTime(new Date()),
      });

      // Also update the contest's user list (old system compatibility)
      const contest = await getContest(contestId);
      if (contest) {
        await updateContest(contestId, {
          users: { ...contest.users, [session.username]: "1" },
        });
      }

      return { success: true, message: "Contest started! You can now access problems and submit solutions." };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to start contest"
      };
    }
  }

  return { error: "Invalid action" };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contests - Codebreaker Contest" },
    { name: "description", content: "View your assigned contests" },
  ];
}

// Utility function to format time
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};


export default function Contests({ loaderData, actionData }: Route.ComponentProps) {
  const { contests } = loaderData;

  // Group contests by status
  const ongoingContests = contests.filter(c => c.status === "ONGOING");
  const upcomingContests = contests.filter(c => c.status === "NOT_STARTED");
  const endedContests = contests.filter(c => c.status === "ENDED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contests</h1>
        <p className="text-muted-foreground">
          View and participate in programming contests
        </p>
      </div>

      {/* Action feedback */}
      {actionData?.success && (
        <div className="rounded-md bg-emerald-50 p-4 border border-emerald-200">
          <div className="text-sm text-emerald-700">
            {actionData.message}
          </div>
        </div>
      )}

      {actionData?.error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="text-sm text-red-700">
            {actionData.error}
          </div>
        </div>
      )}

      {/* No contests message */}
      {contests.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Contests Available</CardTitle>
            <CardDescription>
              You haven't been assigned to any contests yet. Contact an administrator to get access to contests.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Ongoing Contests */}
      {ongoingContests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            Ongoing Contests ({ongoingContests.length})
          </h2>
          <div className="grid gap-4">
            {ongoingContests.map((contest) => (
              <ContestCard key={contest.contestId} contest={contest} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Contests */}
      {upcomingContests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            Upcoming Contests ({upcomingContests.length})
          </h2>
          <div className="grid gap-4">
            {upcomingContests.map((contest) => (
              <ContestCard key={contest.contestId} contest={contest} />
            ))}
          </div>
        </div>
      )}

      {/* Ended Contests */}
      {endedContests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gray-600" />
            Ended Contests ({endedContests.length})
          </h2>
          <div className="grid gap-4">
            {endedContests.map((contest) => (
              <ContestCard key={contest.contestId} contest={contest} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContestCard({ contest }: { contest: UserContestView }) {
  // Determine the primary status to show (avoid redundancy)
  const getContestStatusBadge = () => {
    // For ended contests, show completion status instead of "ENDED"
    if (contest.status === "ENDED") {
      return {
        text: contest.userStatus === "completed" ? "Completed" : "Ended",
        className: contest.userStatus === "completed"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-gray-100 text-gray-700"
      };
    }

    // For ongoing contests, show user participation status
    if (contest.status === "ONGOING") {
      if (contest.userStatus === "started") {
        return { text: "Active", className: "bg-emerald-100 text-emerald-700" };
      } else if (contest.userStatus === "invited") {
        return { text: contest.canStart ? "Ready to Start" : "Invited", className: "bg-blue-100 text-blue-700" };
      }
    }

    // For not started contests
    if (contest.status === "NOT_STARTED") {
      return { text: "Upcoming", className: "bg-amber-100 text-amber-700" };
    }

    // Fallback
    return { text: contest.status.replace("_", " "), className: "bg-gray-100 text-gray-700" };
  };

  const statusBadge = getContestStatusBadge();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {contest.contestName}
              {contest.public ? (
                <Globe className="h-4 w-4 text-blue-500" />
              ) : (
                <Lock className="h-4 w-4 text-gray-500" />
              )}
            </CardTitle>
            {contest.description && (
              <CardDescription>{contest.description}</CardDescription>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={statusBadge.className}>
              {statusBadge.text}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contest Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Mode:</span>
              <Badge variant="outline">
                {contest.mode === "centralized" ? "Centralized" : "Self-Timer"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Start:</span>
              <span>{formatDateTimeWithFallback(contest.startTime)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">End:</span>
              <span>{formatDateTimeWithFallback(contest.endTime)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {contest.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Duration:</span>
                <span>{contest.duration} minutes</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Problems:</span>
              <span>{contest.problems.length} problems</span>
            </div>

            {contest.timeRemaining !== undefined && contest.status === "ONGOING" && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span className="text-gray-600">Time Left:</span>
                <span className="font-mono text-emerald-600">
                  {formatTime(contest.timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {contest.canView && (
            <Button asChild>
              <Link to={`/contests/${contest.contestId}/problems`}>
                <Play className="mr-2 h-4 w-4" />
                Enter Contest
              </Link>
            </Button>
          )}

          {contest.canStart && (
            <Form method="post" className="inline">
              <input type="hidden" name="intent" value="start_contest" />
              <input type="hidden" name="contestId" value={contest.contestId} />
              <Button type="submit" variant="outline">
                <Timer className="mr-2 h-4 w-4" />
                Start Contest
              </Button>
            </Form>
          )}

          {/* Start button for invited users in ongoing centralized contests */}
          {contest.status === "ONGOING" &&
           contest.mode === "centralized" &&
           contest.userStatus === "invited" && (
            <Form method="post" className="inline">
              <input type="hidden" name="intent" value="start_centralized_contest" />
              <input type="hidden" name="contestId" value={contest.contestId} />
              <Button type="submit">
                <Play className="mr-2 h-4 w-4" />
                Start Contest
              </Button>
            </Form>
          )}

          {contest.status === "ONGOING" && (
            <Button asChild variant="outline">
              <Link to={`/contests/${contest.contestId}/scoreboard`}>
                <Trophy className="mr-2 h-4 w-4" />
                Scoreboard
              </Link>
            </Button>
          )}

          {/* View Details - hide when showing Start Contest button */}
          {(contest.status === "ONGOING" || contest.status === "ENDED") &&
           !(contest.status === "ONGOING" && contest.mode === "centralized" && contest.userStatus === "invited") && (
            <Button asChild variant="ghost">
              <Link to={`/contests/${contest.contestId}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}