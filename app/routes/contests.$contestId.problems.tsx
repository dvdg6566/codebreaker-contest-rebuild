import type { Route } from "./+types/contests.$contestId.problems";
import { Link, redirect } from "react-router";
import { Clock, Trophy, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScoreBadge } from "~/components/ui/score-badge";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const { getContest, isUserInActiveContest } = await import("~/lib/contest.server");
  const { getUserContestScores } = await import("~/lib/db/users.server");
  const { getProblemsForContest } = await import("~/lib/db/problems.server");

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Check if user is in active contest session
  const contestStatus = await isUserInActiveContest(session.username, contestId);

  // Get problems and user scores
  const problems = await getProblemsForContest(contest.problems);
  const userScores = await getUserContestScores(session.username, contestId);

  return {
    contest,
    problems,
    userScores,
    contestStatus,
    user: session,
  };
}

export default function ContestProblems({ loaderData }: Route.ComponentProps) {
  const { contest, problems, userScores, contestStatus, user } = loaderData;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalScore = Object.values(userScores).reduce((sum: number, score: number) => sum + score, 0);
  const maxScore = problems.reduce((sum: number, problem: any) =>
    sum + problem.subtaskScores.reduce((pSum: number, s: number) => pSum + s, 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Contest Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link to="/contests" className="hover:text-emerald-600">Contests</Link>
            <span>/</span>
            <span>{contest.contestName}</span>
            <span>/</span>
            <span>Problems</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{contest.contestName} - Problems</h1>
        </div>

        {contestStatus.active && (
          <div className="text-right">
            <div className="text-sm text-gray-600">Time Remaining</div>
            <div className="text-2xl font-mono text-emerald-600">
              {formatTime(contestStatus.timeRemaining)}
            </div>
          </div>
        )}
      </div>

      {/* Contest Status */}
      {!contestStatus.active && (
        <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <Clock className="h-5 w-5 text-amber-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Contest Not Active</h3>
              <div className="mt-2 text-sm text-amber-700">
                {contest.mode === "self-timer"
                  ? "You haven't started this contest yet. You can view problems but cannot submit solutions."
                  : "This contest is not currently running."
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-gray-600">Your Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalScore} / {maxScore}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Problems Solved</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.values(userScores).filter((score: number) => score > 0).length} / {problems.length}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/contests/${contest.contestId}/scoreboard`}>
                <Button variant="outline">
                  <Trophy className="mr-2 h-4 w-4" />
                  Scoreboard
                </Button>
              </Link>
              <Link to={`/contests/${contest.contestId}/submissions`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  My Submissions
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problems Grid */}
      <div className="grid gap-4">
        {problems.map((problem: any, index: number) => {
          const problemScore = userScores[problem.problemName] || 0;
          const maxProblemScore = problem.subtaskScores.reduce((sum: number, s: number) => sum + s, 0);
          const isSolved = problemScore >= maxProblemScore;
          const isPartialSolved = problemScore > 0 && problemScore < maxProblemScore;

          return (
            <Link key={problem.problemName} to={`/contests/${contest.contestId}/problem/${problem.problemName}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                        {String.fromCharCode(65 + index)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{problem.title || problem.problemName}</h3>
                          {isSolved && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                          {isPartialSolved && <div className="h-5 w-5 rounded-full bg-amber-400" />}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Time: {problem.timeLimit}s</span>
                          <span>Memory: {problem.memoryLimit}MB</span>
                          <span>Max Score: {maxProblemScore}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-gray-600">Your Score</div>
                      <div className="text-lg font-semibold">
                        {problemScore} / {maxProblemScore}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {problems.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Problems Available</CardTitle>
            <CardDescription>
              This contest doesn't have any problems yet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}