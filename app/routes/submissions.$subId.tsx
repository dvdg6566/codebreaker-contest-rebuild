import type { Route } from "./+types/submissions.$subId";
import { Link, useRevalidator } from "react-router";
import { useEffect } from "react";
import {
  ChevronLeft,
  Clock,
  HardDrive,
  Code2,
  Copy,
  Download,
  User,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getVerdictIcon } from "~/lib/verdict-utils";
import { getLanguageDisplayName } from "~/lib/languages";
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
import { UserAvatar } from "~/components/ui/user-avatar";
import { Separator } from "~/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Submission #${params.subId} - Codebreaker Contest` },
    { name: "description", content: "View submission details" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Redirect to admin route - only admins should access submissions directly
  const { redirect } = await import("react-router");
  return redirect(`/admin/submissions/${params.subId}`);

  const { requireAdmin } = await import("~/lib/auth.server");
  const { getSubmission, getSubmissionVerdict } = await import("~/lib/db/submissions.server");
  const { getProblem } = await import("~/lib/db/problems.server");
  const { getUser } = await import("~/lib/db/users.server");
  const { getSubmissionSource, getCommunicationSource } = await import("~/lib/s3.server");

  // Admin-only route - users view their submissions via /contests/:contestId/submissions/:subId
  await requireAdmin(request);

  const subId = parseInt(params.subId, 10);
  if (isNaN(subId)) {
    throw new Response("Invalid submission ID", { status: 400 });
  }

  const submission = await getSubmission(subId);
  if (!submission) {
    throw new Response("Submission not found", { status: 404 });
  }

  const [problem, user] = await Promise.all([
    getProblem(submission.problemName),
    getUser(submission.username),
  ]);

  // Get source code from S3
  let code: string | null = null;
  let codeA: string | null = null;
  let codeB: string | null = null;

  if (problem?.problem_type === "Communication") {
    const commSource = await getCommunicationSource(subId, submission.language);
    codeA = commSource.codeA;
    codeB = commSource.codeB;
  } else {
    code = await getSubmissionSource(subId, submission.language);
  }

  const subtaskScores = problem?.subtaskScores || [100];
  const subtaskDeps = problem?.subtaskDependency || ["1-" + (submission.verdicts?.length || 1)];

  // Parse dependencies to build subtask-to-testcase mapping
  const subtasks = subtaskScores.map((maxScore, index) => {
    const depString = subtaskDeps[index] || "";
    const testcaseIds: number[] = [];

    // Parse dependency string like "1-5" or "1,2,3" or "1-3,5"
    const parts = depString.split(",");
    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
        for (let i = start; i <= end; i++) {
          testcaseIds.push(i);
        }
      } else {
        const num = parseInt(part.trim(), 10);
        if (!isNaN(num)) testcaseIds.push(num);
      }
    }

    // Build testcases for this subtask
    const testcases = testcaseIds.map((tcId) => {
      const tcIndex = tcId; // grader is 1-indexed
      const status = submission.status?.[tcIndex] ?? 1;
      const isGraded = status === 2;

      return {
        id: tcId,
        verdict: isGraded ? submission.verdicts?.[tcIndex] || "N/A" : "judging",
        score: isGraded ? submission.score?.[tcIndex] ?? 0 : "-",
        time: isGraded ? ((submission.times?.[tcIndex] ?? 0) / 1000).toFixed(2) : "N/A",
        memory: isGraded ? ((submission.memories?.[tcIndex] ?? 0) / 1000).toFixed(1) : "N/A",
      };
    });

    // Determine subtask verdict
    const allAC = testcases.every((tc) => tc.verdict === "AC");
    const hasNonAC = testcases.some((tc) => tc.verdict !== "AC" && tc.verdict !== "judging" && tc.verdict !== "N/A");
    const subtaskVerdict = allAC ? "AC" : hasNonAC ? testcases.find((tc) => tc.verdict !== "AC" && tc.verdict !== "judging" && tc.verdict !== "N/A")?.verdict || "N/A" : "judging";

    const subtaskPct = submission.subtaskScores?.[index] ?? 0;
    const scoreVerdict = subtaskPct === 100 ? "AC" : subtaskPct === 0 ? "WA" : "PS";
    return {
      id: index + 1,
      maxScore,
      yourScore: +((subtaskPct * maxScore / 100).toFixed(2)),
      verdict: subtaskVerdict,
      scoreVerdict,
      testcases,
    };
  });

  const maxScore = subtaskScores.reduce((sum, s) => sum + s, 0);

  const languageDisplay = getLanguageDisplayName(submission.language);

  return {
    isAdmin: true, // This route is admin-only
    submissionData: {
      id: submission.subId,
      username: submission.username,
      displayName: user?.fullname || submission.username,
      contestId: submission.contestId,
      problem: problem?.title || submission.problemName,
      problemId: submission.problemName,
      problemType: problem?.problem_type || "Batch",
      nameA: problem?.nameA,
      nameB: problem?.nameB,
      language: languageDisplay,
      verdict: getSubmissionVerdict(submission),
      totalScore: submission.totalScore,
      maxScore,
      maxTime: submission.gradingCompleteTime ? (submission.maxTime / 1000).toFixed(2) : "N/A",
      maxMemory: submission.gradingCompleteTime ? (submission.maxMemory / 1000).toFixed(1) : "N/A",
      submissionTime: submission.submissionTime,
      gradingCompleteTime: submission.gradingCompleteTime || "Grading...",
      compileError: submission.compileErrorMessage || null,
      code,
      codeA,
      codeB,
      subtasks,
      isGrading: !submission.gradingCompleteTime,
    },
  };
}


export default function SubmissionDetail({ loaderData }: Route.ComponentProps) {
  const { submissionData, isAdmin } = loaderData;
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!submissionData.isGrading) return;
    const interval = setInterval(() => revalidator.revalidate(), 1000);
    return () => clearInterval(interval);
  }, [submissionData.isGrading]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={isAdmin ? "/admin/submissions" : `/contests/${submissionData.contestId}/submissions`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                Submission #{submissionData.id}
              </h1>
              <ScoreBadge
                verdict={submissionData.verdict as VerdictType}
                className="text-sm px-3 py-1"
              />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <Link
                to={`/admin/problem/${submissionData.problemId}`}
                className="hover:underline"
              >
                {submissionData.problem}
              </Link>
              <span>•</span>
              <span>{submissionData.language}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Subtask Results */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Subtask Results</CardTitle>
                <div className="text-lg font-bold">
                  {submissionData.totalScore}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {submissionData.maxScore}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {submissionData.subtasks.map((subtask) => (
                <Collapsible key={subtask.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        {getVerdictIcon(subtask.verdict)}
                        <span className="font-medium">Subtask {subtask.id}</span>
                        <Badge variant="outline" className="text-xs">
                          {subtask.testcases.length} testcases
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreBadge
                          verdict={subtask.scoreVerdict as VerdictType}
                          score={subtask.yourScore}
                        />
                        <span className="text-sm text-muted-foreground">
                          / {subtask.maxScore}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-4 border-l-2 border-muted pl-4">
                      <div className="grid grid-cols-5 gap-2 py-2 text-xs text-muted-foreground font-medium">
                        <span>Test</span>
                        <span className="text-center">Verdict</span>
                        <span className="text-center">Score</span>
                        <span className="text-center">Time</span>
                        <span className="text-center">Memory</span>
                      </div>
                      {subtask.testcases.map((tc) => (
                        <div
                          key={tc.id}
                          className="grid grid-cols-5 gap-2 py-2 text-sm border-t border-muted/50"
                        >
                          <span className="text-muted-foreground">#{tc.id}</span>
                          <span className="text-center">
                            <ScoreBadge verdict={tc.verdict as VerdictType} />
                          </span>
                          <span className="text-center">{tc.score}</span>
                          <span className="text-center text-muted-foreground">
                            {tc.time === "N/A" ? "N/A" : `${tc.time}s`}
                          </span>
                          <span className="text-center text-muted-foreground">
                            {tc.memory === "N/A" ? "N/A" : `${tc.memory} MB`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {/* Source Code */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Source Code</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {submissionData.language}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {submissionData.problemType === "Communication" ? (
                <Tabs defaultValue="codeA">
                  <TabsList className="mb-4">
                    <TabsTrigger value="codeA">
                      {submissionData.nameA || "File A"}
                    </TabsTrigger>
                    <TabsTrigger value="codeB">
                      {submissionData.nameB || "File B"}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="codeA">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code className="font-mono">{submissionData.codeA || "Source code not available"}</code>
                    </pre>
                  </TabsContent>
                  <TabsContent value="codeB">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code className="font-mono">{submissionData.codeB || "Source code not available"}</code>
                    </pre>
                  </TabsContent>
                </Tabs>
              ) : (
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="font-mono">{submissionData.code || "Source code not available"}</code>
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Compile Error (if any) */}
          {submissionData.compileError && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="text-base text-red-600">
                  Compilation Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-red-50 text-red-800 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{submissionData.compileError}</code>
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Submission Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Submission Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Submitted by</p>
                  <Link
                    to={`/profile/${submissionData.username}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <UserAvatar
                      name={submissionData.displayName}
                      size="sm"
                    />
                    <span className="text-sm font-medium">
                      {submissionData.displayName}
                    </span>
                  </Link>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Submitted at</p>
                  <p className="text-sm">{submissionData.submissionTime}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Grading completed</p>
                  <p className="text-sm">{submissionData.gradingCompleteTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Max Time
                </div>
                <span className="font-medium">{submissionData.maxTime}s</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Max Memory
                </div>
                <span className="font-medium">{submissionData.maxMemory} MB</span>
              </div>
            </CardContent>
          </Card>

          {/* Related Links */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Related</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={`/admin/problem/${submissionData.problemId}`}>
                  <Code2 className="h-4 w-4 mr-2" />
                  View Problem
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link
                  to={`/submissions?username=${submissionData.username}&problem=${submissionData.problemId}`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  All Submissions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
