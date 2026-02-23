import type { Route } from "./+types/problems";
import { Link, Form } from "react-router";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Play,
  Trophy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScoreBadge } from "~/components/ui/score-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getProblemsForContest } from "~/lib/db/problems.server";
import { getScoreboard } from "~/lib/db/scoreboard.server";
import { getMaxScore } from "~/types/database";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { isUserInActiveContest } = await import("~/lib/contest.server");

  const session = await requireAuth(request);
  const contestStatus = await isUserInActiveContest(session.username);

  // If not in active contest, return empty state
  if (!contestStatus.active) {
    return {
      problems: [],
      contest: contestStatus.contest,
      contestStatus: {
        active: false,
        canStart: contestStatus.contest?.mode === "self-timer",
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null,
      },
    };
  }

  // Get user's scores from scoreboard
  const scoreboard = await getScoreboard(contestStatus.contest!.contestId);
  const userScores = scoreboard.find(s => s.username === session.username);

  // Only show problems that are in this contest
  const contestProblemNames = contestStatus.contest?.problems || [];
  const contestProblems = await getProblemsForContest(contestProblemNames);

  // Transform problems to include user scores
  const problems = contestProblems.map((problem, index) => {
    const userProblemScore = userScores?.problems.find(p => p.problemName === problem.problemName);
    const maxScore = getMaxScore(problem);
    return {
      problemName: problem.problemName,
      title: problem.title,
      difficulty: problem.difficulty
        ? problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)
        : "Medium",
      timeLimit: `${problem.timeLimit}s`,
      memoryLimit: `${problem.memoryLimit} MB`,
      score: userProblemScore?.score ?? null,
      maxScore,
      solved: userProblemScore?.score === maxScore,
      type: problem.problem_type,
      subtasks: problem.subtaskScores.length,
      source: contestStatus.contest?.contestName ?? "Contest",
    };
  });

  return {
    problems,
    contest: contestStatus.contest,
    contestStatus: {
      active: true,
      canStart: false,
      timeRemaining: contestStatus.timeRemaining,
      contestStart: contestStatus.contestStart?.toISOString() ?? null,
      contestEnd: contestStatus.contestEnd?.toISOString() ?? null,
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { startUserContest } = await import("~/lib/contest.server");

  const session = await requireAuth(request);
  const formData = await request.formData();
  const contestId = formData.get("contestId") as string;

  if (!contestId) {
    return { error: "Contest ID required" };
  }

  try {
    startUserContest(session.username, contestId);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to start contest" };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Problems - Codebreaker Contest" },
    { name: "description", content: "View contest problems" },
  ];
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Hard: "bg-red-100 text-red-700",
};

export default function Problems({ loaderData }: Route.ComponentProps) {
  const { problems, contest, contestStatus } = loaderData;
  const totalScore = problems.reduce((sum: number, p: { score: number | null }) => sum + (p.score ?? 0), 0);
  const maxScore = problems.reduce((sum: number, p: { maxScore: number }) => sum + p.maxScore, 0);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // No active contest - show empty state
  if (!contestStatus.active) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
          <p className="text-muted-foreground">Contest problems</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            {contest && contestStatus.canStart ? (
              <>
                <h3 className="text-xl font-semibold mb-2">{contest.contestName}</h3>
                <p className="text-muted-foreground mb-6">
                  {contest.description}
                  <br />
                  <span className="text-sm">
                    Duration: {contest.duration} minutes
                  </span>
                </p>
                <Form method="post">
                  <input type="hidden" name="contestId" value={contest.contestId} />
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                    <Play className="h-4 w-4 mr-2" />
                    Start Contest
                  </Button>
                </Form>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-2">No Active Contest</h3>
                <p className="text-muted-foreground">
                  There is no contest running at the moment.
                  <br />
                  Check back later or contact an administrator.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
          <p className="text-muted-foreground">
            {contest?.contestName ?? "Contest problems"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Time Remaining</p>
            <p className="text-xl font-bold text-emerald-600 font-mono">
              {formatTime(contestStatus.timeRemaining)}
            </p>
          </div>
          <Badge variant="outline" className="text-base px-3 py-1">
            Score: {totalScore} / {maxScore}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search problems..."
                className="pl-9 bg-muted/50"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
                <SelectItem value="attempted">Attempted</SelectItem>
                <SelectItem value="unattempted">Not Attempted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Problems List */}
      <div className="space-y-3">
        {problems.map((problem: {
          problemName: string;
          title: string;
          difficulty: string;
          type: string;
          timeLimit: string;
          memoryLimit: string;
          subtasks: number;
          source: string;
          score: number | null;
          maxScore: number;
          solved: boolean;
        }, index: number) => (
          <Link key={problem.problemName} to={`/problems/${problem.problemName}`}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Problem Number */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground">
                    {String.fromCharCode(65 + index)}
                  </div>

                  {/* Problem Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{problem.title}</h3>
                      <Badge
                        variant="outline"
                        className={difficultyColors[problem.difficulty]}
                      >
                        {problem.difficulty}
                      </Badge>
                      {problem.type === "Communication" && (
                        <Badge variant="secondary">Communication</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {problem.timeLimit}
                      </span>
                      <span>{problem.memoryLimit}</span>
                      <span>{problem.subtasks} subtasks</span>
                      {problem.source && <span>{problem.source}</span>}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-3">
                    {problem.solved ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : problem.score !== null && problem.score > 0 ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : null}
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {problem.score ?? "-"}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          / {problem.maxScore}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {problem.solved
                          ? "Solved"
                          : problem.score
                            ? "Attempted"
                            : "Not Attempted"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
