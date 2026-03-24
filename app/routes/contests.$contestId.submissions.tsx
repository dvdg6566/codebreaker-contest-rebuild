import type { Route } from "./+types/contests.$contestId.submissions";
import { Link, useRevalidator } from "react-router";
import { useEffect } from "react";
import { useContestWebSocket } from "~/hooks/useContestWebSocket";
import {
  Clock,
  Code2,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  HardDrive,
  FileText,
  ChevronLeft
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScoreBadge, type VerdictType } from "~/components/ui/score-badge";
import { UserAvatar } from "~/components/ui/user-avatar";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const { getContest } = await import("~/lib/contest.server");

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Get submissions for this contest efficiently using GSI
  const { getSubmissionsByContestAndUser } = await import("~/lib/db/submissions.server");
  const { getProblem } = await import("~/lib/db/problems.server");
  const contestSubmissions = await getSubmissionsByContestAndUser(contestId, session.username, 200);

  // Get problem details for title mapping
  const problemDetails = new Map();
  for (const problemName of contest.problems) {
    const problem = await getProblem(problemName);
    if (problem) {
      problemDetails.set(problemName, problem);
    }
  }

  return {
    contest,
    user: session,
    submissions: contestSubmissions,
    problemDetails: Object.fromEntries(problemDetails),
  };
}

const verdictIcon = (verdict: string) => {
  switch (verdict) {
    case "AC":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "WA":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "TLE":
      return <Timer className="h-4 w-4 text-orange-500" />;
    case "MLE":
      return <HardDrive className="h-4 w-4 text-purple-500" />;
    case "RTE":
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
    case "PS":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case "CE":
      return <Code2 className="h-4 w-4 text-gray-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
};

export default function ContestSubmissions({ loaderData }: Route.ComponentProps) {
  const { contest, user, submissions, problemDetails } = loaderData;
  const revalidator = useRevalidator();

  useContestWebSocket(contest.contestId);

  // Auto-refresh if there are pending submissions
  useEffect(() => {
    const hasPending = submissions.some((s: any) => !s.gradingCompleteTime);
    if (!hasPending) return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 3000);

    return () => clearInterval(interval);
  }, [submissions]);

  const formatDateTime = (dateTime: string) => {
    try {
      return new Date(dateTime.replace(" ", "T") + "Z").toLocaleString();
    } catch {
      return dateTime;
    }
  };

  const getSubmissionVerdict = (submission: any) => {
    if (!submission.gradingCompleteTime) return "Grading...";
    if (submission.compileErrorMessage) return "CE";

    const problem = problemDetails[submission.problemName];
    if (!problem) return "PS";

    const maxScore = problem.subtaskScores.reduce((sum: number, s: number) => sum + s, 0);
    if (submission.totalScore === maxScore) return "AC";
    if (submission.totalScore === 0) return "WA";
    return "PS";
  };

  const getLanguageDisplay = (lang: string) => {
    switch (lang) {
      case "cpp": return "C++ 17";
      case "py": return "Python 3";
      case "java": return "Java";
      default: return lang;
    }
  };

  // Group submissions by problem
  const submissionsByProblem = submissions.reduce((acc: any, sub: any) => {
    if (!acc[sub.problemName]) {
      acc[sub.problemName] = [];
    }
    acc[sub.problemName].push(sub);
    return acc;
  }, {});

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
        <span>Submissions</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {contest.contestName} - My Submissions
          </h1>
          <p className="text-gray-600 mt-1">
            Your submission history for this contest
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/contests/${contest.contestId}/problems`}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Problems
            </Link>
          </Button>
        </div>
      </div>

      {/* Submissions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-sm text-gray-600">Total Submissions</div>
                <div className="text-2xl font-bold">{submissions.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-sm text-gray-600">Accepted</div>
                <div className="text-2xl font-bold">
                  {submissions.filter((s: any) => getSubmissionVerdict(s) === "AC").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-sm text-gray-600">Pending</div>
                <div className="text-2xl font-bold">
                  {submissions.filter((s: any) => !s.gradingCompleteTime).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-sm text-gray-600">Problems Attempted</div>
                <div className="text-2xl font-bold">{Object.keys(submissionsByProblem).length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Code2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Submissions Yet</h3>
            <p className="text-gray-600 mb-4">
              You haven't submitted any solutions to problems in this contest.
            </p>
            <Button asChild>
              <Link to={`/contests/${contest.contestId}/problems`}>
                <Code2 className="h-4 w-4 mr-2" />
                View Problems
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submission History
            </CardTitle>
            <CardDescription>
              Click on any submission to view detailed results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Time</TableHead>
                    <TableHead className="text-center">Memory</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission: any) => {
                    const verdict = getSubmissionVerdict(submission);
                    const problem = problemDetails[submission.problemName];
                    const maxScore = problem?.subtaskScores.reduce((sum: number, s: number) => sum + s, 0) || 100;

                    return (
                      <TableRow key={submission.subId} className="hover:bg-gray-50">
                        <TableCell className="font-medium">#{submission.subId}</TableCell>
                        <TableCell>
                          <Link
                            to={`/contests/${contest.contestId}/problem/${submission.problemName}`}
                            className="hover:underline"
                          >
                            {problem?.title || submission.problemName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getLanguageDisplay(submission.language)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {verdictIcon(verdict)}
                            <ScoreBadge verdict={verdict as VerdictType} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {submission.totalScore || 0} / {maxScore}
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-600">
                          {submission.gradingCompleteTime && submission.maxTime
                            ? `${(submission.maxTime / 1000).toFixed(2)}s`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-600">
                          {submission.gradingCompleteTime && submission.maxMemory
                            ? `${(submission.maxMemory / 1000).toFixed(1)} MB`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDateTime(submission.submissionTime)}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/contests/${contest.contestId}/submissions/${submission.subId}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}