import type { Route } from "./+types/scoreboard";
import { Link } from "react-router";
import {
  Trophy,
  Medal,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { UserAvatar } from "~/components/ui/user-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { getScoreboard } from "~/lib/db/scoreboard.server";
import { getProblemsForContest } from "~/lib/db/problems.server";
import { format } from "date-fns";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { isUserInActiveContest } = await import("~/lib/contest.server");

  const session = await requireAuth(request);
  const contestStatus = await isUserInActiveContest(session.username);

  // If not in active contest, return empty state
  if (!contestStatus.active || !contestStatus.contest) {
    return {
      contestInfo: null,
      participants: [],
      currentUser: session,
      contestActive: false,
      timeRemaining: 0,
    };
  }

  const contest = contestStatus.contest;

  // Build contest info with only contest problems
  const contestProblemNames = contest.problems;
  const problems = await getProblemsForContest(contestProblemNames);

  const contestInfo = {
    name: contest.contestName,
    startTime: contestStatus.contestStart ? format(new Date(contestStatus.contestStart), "yyyy-MM-dd HH:mm:ss") : "N/A",
    endTime: contestStatus.contestEnd ? format(new Date(contestStatus.contestEnd), "yyyy-MM-dd HH:mm:ss") : "N/A",
    status: "ONGOING",
    problems: problems.map((_, i) => String.fromCharCode(65 + i)),
    problemNames: problems.map(p => p.title),
    problemIds: problems.map(p => p.problemName),
  };

  // Build participants from scoreboard
  const scoreboard = await getScoreboard(contest.contestId);
  const participants = scoreboard.map((entry) => {
    const scores: Record<string, number | string> = {};
    contestInfo.problems.forEach((letter, index) => {
      const problemEntry = entry.problems[index];
      scores[letter] = problemEntry?.score ?? "-";
    });

    return {
      rank: entry.rank,
      username: entry.username,
      displayName: entry.fullname || entry.username,
      totalScore: entry.totalScore,
      status: entry.totalTime > 0 ? "Ongoing" : "Not Started",
      change: entry.rank <= 2 ? "up" : entry.rank === 3 ? "down" : "same",
      scores,
      isCurrentUser: entry.username === session.username,
    };
  });

  return {
    contestInfo,
    participants,
    currentUser: session,
    contestActive: true,
    timeRemaining: contestStatus.timeRemaining,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Scoreboard - Codebreaker Contest" },
    { name: "description", content: "View contest rankings" },
  ];
}

const getScoreColor = (score: number | string) => {
  if (score === "-") return "text-gray-400";
  if (typeof score !== "number") return "text-gray-400";
  if (score === 100) return "bg-emerald-100 text-emerald-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  if (score > 0) return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-500";
};

const getRankBadge = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="font-semibold text-muted-foreground">#{rank}</span>;
};

const getChangeIcon = (change: string) => {
  if (change === "up") return <ChevronUp className="h-4 w-4 text-emerald-500" />;
  if (change === "down") return <ChevronDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

export default function Scoreboard({ loaderData }: Route.ComponentProps) {
  const { contestInfo, participants, currentUser, contestActive, timeRemaining } = loaderData;

  // Format time remaining
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // No active contest - show empty state
  if (!contestActive || !contestInfo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scoreboard</h1>
          <p className="text-muted-foreground">Contest rankings</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Active Contest</h3>
            <p className="text-muted-foreground">
              You are not currently participating in any contest.
              <br />
              Start a contest to view the scoreboard.
            </p>
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
          <h1 className="text-2xl font-bold tracking-tight">Scoreboard</h1>
          <p className="text-muted-foreground">{contestInfo.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Contest Status</p>
            <Badge
              variant={contestInfo.status === "ONGOING" ? "success" : "secondary"}
            >
              {contestInfo.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Contest Timer */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Time Remaining</p>
                <p className="text-2xl font-bold text-emerald-600 font-mono">{formatTime(timeRemaining)}</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="font-medium">{contestInfo.startTime}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Time</p>
                <p className="font-medium">{contestInfo.endTime}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participants</p>
                <p className="font-medium">{participants.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoreboard Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px] text-center">#</TableHead>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Participant</TableHead>
                {contestInfo.problems.map((problem, index) => (
                  <TableHead key={problem} className="text-center w-[80px]">
                    <Link
                      to={`/problems/${contestInfo.problemIds[index]}`}
                      className="hover:underline"
                    >
                      {problem}
                    </Link>
                  </TableHead>
                ))}
                <TableHead className="text-center w-[100px]">Total</TableHead>
                <TableHead className="text-center w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow
                  key={participant.username}
                  className={cn(
                    participant.isCurrentUser && "bg-emerald-50",
                    "hover:bg-muted/50"
                  )}
                >
                  <TableCell className="text-center">
                    {getRankBadge(participant.rank)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getChangeIcon(participant.change)}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/profile/${participant.username}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <UserAvatar
                        name={participant.displayName}
                        size="sm"
                      />
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          participant.isCurrentUser && "text-emerald-700"
                        )}>
                          {participant.displayName}
                          {participant.isCurrentUser && " (You)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{participant.username}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  {contestInfo.problems.map((problem) => (
                    <TableCell key={problem} className="text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold min-w-[2.5rem]",
                          getScoreColor(participant.scores[problem as keyof typeof participant.scores])
                        )}
                      >
                        {participant.scores[problem as keyof typeof participant.scores]}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <span className="text-lg font-bold">
                      {participant.totalScore}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={participant.status === "Finished" ? "success" : "secondary"}
                      className="text-xs"
                    >
                      {participant.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
