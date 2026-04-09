import type { Route } from "./+types/contests.$contestId.scoreboard";
import { Link, useRevalidator } from "react-router";
import { useEffect } from "react";
import { useContestWebSocket } from "~/hooks/useContestWebSocket";
import { Trophy, Medal, Award, Clock, Target } from "lucide-react";
import type { ScoreboardEntry } from "~/lib/db/scoreboard.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { isContestOngoing } from "~/lib/contest-utils";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const { requireAuth } = await import("~/lib/auth.server");
  const { canUserAccessContest, getContest } = await import("~/lib/contest.server");
  const { getScoreboard } = await import("~/lib/db/scoreboard.server");

  const user = await requireAuth(request);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Access control based on scoreboard visibility
  const visibility = contest.scoreboardVisibility || (contest.publicScoreboard ? "public" : "hidden");
  const isAdmin = user.role === "admin";

  if (visibility === "hidden" && !isAdmin) {
    throw new Response("Scoreboard is hidden", { status: 403 });
  } else if (visibility === "participants" && !isAdmin) {
    const userInContest = await canUserAccessContest(user.username, contestId);
    if (!userInContest) {
      throw new Response("You are not a participant in this contest", { status: 403 });
    }
  }
  // Public visibility allows any authenticated user

  const scoreboard = await getScoreboard(contestId);

  return {
    contest,
    user,
    scoreboard,
    visibility,
    isAdmin,
  };
}

export default function ContestScoreboard({ loaderData }: Route.ComponentProps) {
  const { contest, user, scoreboard } = loaderData;
  const revalidator = useRevalidator();

  useContestWebSocket(contest.contestId);

  // Check if contest is still ongoing for auto-refresh
  const contestOngoing = isContestOngoing(contest);

  // Auto-refresh scoreboard every 30 seconds during active contest
  useEffect(() => {
    if (!contestOngoing) return;

    const interval = setInterval(() => {
      // Only refresh if page is visible to save bandwidth
      if (document.visibilityState === 'visible') {
        revalidator.revalidate();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [contestOngoing, revalidator]);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link to="/contests" className="hover:text-emerald-600">Contests</Link>
        <span>/</span>
        <Link to={`/contests/${contest.contestId}`} className="hover:text-emerald-600">
          {contest.contestName}
        </Link>
        <span>/</span>
        <span>Scoreboard</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            {contest.contestName} - Scoreboard
          </h1>
        </div>
        {contestOngoing && (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Auto-refreshes every 30s
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-sm text-gray-600">Total Participants</div>
                <div className="text-2xl font-bold">{scoreboard.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-sm text-gray-600">Problems</div>
                <div className="text-2xl font-bold">{contest.problems.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-sm text-gray-600">Top Score</div>
                <div className="text-2xl font-bold">
                  {scoreboard.length > 0 ? scoreboard[0].totalScore : 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoreboard Table */}
      {scoreboard.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Submissions Yet</h3>
            <p className="text-gray-600">
              Rankings will appear once participants start submitting solutions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    {contest.problems.map(problemName => (
                      <TableHead key={problemName} className="text-center min-w-20">
                        {problemName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scoreboard.map((entry) => (
                    <TableRow key={entry.username} className={entry.username === user.username ? "bg-blue-50" : ""}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getRankIcon(entry.rank)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.fullname}</div>
                          <div className="text-sm text-gray-500">{entry.username}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg font-semibold">
                        {entry.totalScore}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600">
                        {entry.totalTime > 0 ? formatTime(entry.totalTime) : "-"}
                      </TableCell>
                      {entry.problems.map((problem) => (
                        <TableCell key={problem.problemName} className="text-center">
                          {problem.score > 0 ? (
                            <div>
                              <Badge
                                variant={problem.score === problem.maxScore ? "default" : "secondary"}
                                className="mb-1"
                              >
                                {problem.score}
                              </Badge>
                              {problem.attempts > 1 && (
                                <div className="text-xs text-gray-500">
                                  ({problem.attempts} tries)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}