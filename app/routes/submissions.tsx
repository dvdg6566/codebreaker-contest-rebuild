import type { Route } from "./+types/submissions";
import { Link, useSearchParams } from "react-router";
import {
  Clock,
  CheckCircle2,
  Send,
  FileText,
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
import { ScoreBadge, type VerdictType } from "~/components/ui/score-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  getSubmissionsByUser,
  formatSubmissionForDisplay,
} from "~/lib/db/submissions.server";
import { getProblemsForContest } from "~/lib/db/problems.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { isUserInActiveContest } = await import("~/lib/contest.server");

  const session = await requireAuth(request);
  const contestStatus = isUserInActiveContest(session.username);

  // If not in active contest, return empty state
  if (!contestStatus.active) {
    return {
      submissions: [],
      problems: [],
      currentUser: session,
      contestActive: false,
    };
  }

  // Get user's submissions (only for current contest problems)
  const contestProblemNames = contestStatus.contest?.problems || [];
  const allSubmissions = await getSubmissionsByUser(session.username);
  const userSubmissions = allSubmissions.filter((sub) =>
    contestProblemNames.includes(sub.problemName)
  );

  // Transform to display format
  const submissions = userSubmissions.map(formatSubmissionForDisplay);

  const problems = await getProblemsForContest(contestProblemNames);
  const problemList = problems.map((p) => ({
    problemName: p.problemName,
    title: p.title,
  }));

  return { submissions, problems: problemList, currentUser: session, contestActive: true };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Submissions - Codebreaker Contest" },
    { name: "description", content: "View your submissions" },
  ];
}

export default function Submissions({ loaderData }: Route.ComponentProps) {
  const { submissions, problems, currentUser, contestActive } = loaderData;
  const [searchParams] = useSearchParams();
  const problemFilter = searchParams.get("problem") || "";

  // No active contest - show empty state
  if (!contestActive) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Submissions</h1>
          <p className="text-muted-foreground">View your contest submissions</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Send className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Active Contest</h3>
            <p className="text-muted-foreground">
              You are not currently participating in any contest.
              <br />
              Start a contest to view your submissions.
            </p>
            <Button asChild className="mt-6">
              <Link to="/problems">View Contests</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate stats
  const totalSubmissions = submissions.length;
  const acceptedSubmissions = submissions.filter(
    (s: { verdict: string }) => s.verdict === "AC"
  ).length;
  const problemsAttempted = new Set(
    submissions.map((s: { problemName: string }) => s.problemName)
  ).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Submissions</h1>
        <p className="text-muted-foreground">
          View your contest submissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold">{acceptedSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Problems Attempted</p>
                <p className="text-2xl font-bold">{problemsAttempted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Select defaultValue={problemFilter || "all"}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Problems" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Problems</SelectItem>
                {problems.map((problem) => (
                  <SelectItem key={problem.problemName} value={problem.problemName}>
                    {problem.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Verdicts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verdicts</SelectItem>
                <SelectItem value="AC">Accepted</SelectItem>
                <SelectItem value="WA">Wrong Answer</SelectItem>
                <SelectItem value="TLE">Time Limit</SelectItem>
                <SelectItem value="MLE">Memory Limit</SelectItem>
                <SelectItem value="RTE">Runtime Error</SelectItem>
                <SelectItem value="CE">Compile Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="text-center">Verdict</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Time</TableHead>
                <TableHead className="text-center">Memory</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.subId} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link
                      to={`/submissions/${sub.subId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {sub.subId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/problems/${sub.problemName}`}
                      className="text-sm hover:underline"
                    >
                      {sub.problemTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {sub.languageDisplay}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge verdict={sub.verdict as VerdictType} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">{sub.score}</span>
                    <span className="text-muted-foreground">/{sub.maxScore}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">
                      {sub.time === "N/A" ? "N/A" : `${sub.time}s`}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">
                      {sub.memory === "N/A" ? "N/A" : `${sub.memory} MB`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {sub.submissionTime}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Empty State */}
      {submissions.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Submissions Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't made any submissions yet. Head to the problems page to start solving!
            </p>
            <Button asChild>
              <Link to="/problems">View Problems</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {submissions.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-{submissions.length} of {submissions.length} submissions
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
