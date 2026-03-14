import type { Route } from "./+types/contests.$contestId.index";
import { Link, redirect, Form } from "react-router";
import { Clock, Users, FileText, Calendar, Trophy, Timer, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireContestAccess } from "~/lib/auth.server";
import { getContest, isUserInActiveContest } from "~/lib/contest.server";
import { getUserContestScores } from "~/lib/db/users.server";
import { getProblemsForContest } from "~/lib/db/problems.server";
import { useCountdown, formatTime } from "~/hooks/useCountdown";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Check contest status for this user
  const contestStatus = await isUserInActiveContest(session.username, contestId);

  // Get user's scores and problem count (handle invited users safely)
  const userScores = (await getUserContestScores(session.username, contestId)) || {};
  const problems = await getProblemsForContest(contest.problems);

  return {
    contest,
    contestStatus,
    userScores,
    problemCount: problems.length,
    user: session,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { contestId } = params;
  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const session = await requireContestAccess(request, contestId);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "start-centralized-contest") {
    const { updateUserContestStatus } = await import("~/lib/db/users.server");
    const { formatDateTime } = await import("~/types/database");

    try {
      // Mark user as started for centralized contest
      await updateUserContestStatus(session.username, contestId, {
        status: "started",
        startedAt: formatDateTime(new Date()),
      });

      return { success: true, message: "Contest started! You can now view problems and submit solutions." };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to start contest"
      };
    }
  }

  return { error: "Invalid action" };
}

export default function ContestIndex({ loaderData, actionData }: Route.ComponentProps) {
  const { contest, contestStatus, userScores, problemCount, user } = loaderData;

  // Use countdown hook for real-time updates when contest is active
  const timeRemaining = useCountdown(contestStatus.timeRemaining || 0);

  const formatDateTime = (dateTimeStr: string) => {
    if (dateTimeStr === "9999-12-31 23:59:59") return "Not set";

    try {
      const date = new Date(dateTimeStr.replace(" ", "T") + "Z");
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  const totalScore = userScores ? Object.values(userScores).reduce((sum: number, score: number) => sum + score, 0) : 0;
  const solvedProblems = userScores ? Object.values(userScores).filter((score: number) => score > 0).length : 0;

  // Determine contest status
  let statusBadgeColor = "bg-gray-100 text-gray-700";
  let statusText = "Unknown";

  if (contestStatus.active) {
    statusBadgeColor = "bg-emerald-100 text-emerald-700";
    statusText = "Active";
  } else if (contest.mode === "self-timer" && !contestStatus.participation) {
    statusBadgeColor = "bg-blue-100 text-blue-700";
    statusText = "Ready to Start";
  } else if (contest.mode === "centralized" && contestStatus.contest?.contestId === contest.contestId) {
    // Centralized contest that user is invited to but not actively participating
    statusBadgeColor = "bg-blue-100 text-blue-700";
    statusText = "Invited";
  } else {
    statusBadgeColor = "bg-amber-100 text-amber-700";
    statusText = "Waiting";
  }

  return (
    <div className="space-y-6">
      {/* Contest Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link to="/contests" className="hover:text-emerald-600">Contests</Link>
            <span>/</span>
            <span>{contest.contestName}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{contest.contestName}</h1>
          {contest.description && (
            <p className="text-lg text-gray-600 mt-1">{contest.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge className={statusBadgeColor}>
            {statusText}
          </Badge>
          {contestStatus.active && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Time Remaining</div>
              <div className="text-xl font-mono text-emerald-600">
                {formatTime(timeRemaining)}
              </div>
            </div>
          )}
        </div>
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

      {/* Contest Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-sm text-gray-600">Mode</div>
                <div className="font-medium">
                  {contest.mode === "centralized" ? "Centralized" : "Self-Timer"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-sm text-gray-600">Problems</div>
                <div className="font-medium">{problemCount} problems</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {contest.duration && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="text-sm text-gray-600">Duration</div>
                  <div className="font-medium">{contest.duration} minutes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-sm text-gray-600">Your Score</div>
                <div className="font-medium">{totalScore} points</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contest Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Contest Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Start:</span>
              <span>{formatDateTime(contest.startTime)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">End:</span>
              <span>{formatDateTime(contest.endTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{solvedProblems}</div>
              <div className="text-sm text-gray-600">Problems Solved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalScore}</div>
              <div className="text-sm text-gray-600">Total Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{problemCount - solvedProblems}</div>
              <div className="text-sm text-gray-600">Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {problemCount > 0 ? Math.round((solvedProblems / problemCount) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Completion</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {/* Start Contest button for invited users in ongoing centralized contests */}
        {!contestStatus.active && contest.mode === "centralized" && statusText === "Invited" && (
          <Form method="post" className="inline">
            <input type="hidden" name="intent" value="start-centralized-contest" />
            <Button type="submit" size="lg">
              <Play className="mr-2 h-5 w-5" />
              Start Contest
            </Button>
          </Form>
        )}

        {/* View Problems button for active users */}
        {contestStatus.active && (
          <Link to={`/contests/${contest.contestId}/problems`}>
            <Button size="lg">
              <Play className="mr-2 h-5 w-5" />
              View Problems
            </Button>
          </Link>
        )}

        <Link to={`/contests/${contest.contestId}/submissions`}>
          <Button variant="outline" size="lg">
            <FileText className="mr-2 h-5 w-5" />
            My Submissions
          </Button>
        </Link>

        <Link to={`/contests/${contest.contestId}/scoreboard`}>
          <Button variant="outline" size="lg">
            <Trophy className="mr-2 h-5 w-5" />
            Scoreboard
          </Button>
        </Link>
      </div>

      {/* Contest Status Messages */}
      {!contestStatus.active && contest.mode === "self-timer" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">Self-Timer Contest</h3>
                <p className="text-blue-700 mt-1">
                  You can start this contest when ready. Once started, you'll have {contest.duration} minutes to complete it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!contestStatus.active && contest.mode === "centralized" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">Centralized Contest</h3>
                <p className="text-blue-700 mt-1">
                  You're invited to this contest. Click "Start Contest" above to begin participating and access the problems.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}