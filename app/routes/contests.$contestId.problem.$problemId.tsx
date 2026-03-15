import type { Route } from "./+types/contests.$contestId.problem.$problemId";
import { Link, Form, useFetcher, useRevalidator, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useContestWebSocket } from "~/hooks/useContestWebSocket";
import {
  ChevronLeft,
  Clock,
  HardDrive,
  Download,
  Code2,
  Send,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScoreBadge, type VerdictType } from "~/components/ui/score-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId, problemId } = params;

  if (!contestId || !problemId) {
    throw new Response("Contest ID and Problem ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const { getContest, isUserInActiveContest } = await import("~/lib/contest.server");
  const { getProblem } = await import("~/lib/db/problems.server");
  const { getSubmissionsByUserAndProblem } = await import("~/lib/db/submissions.server");

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Check if problem is part of this contest
  if (!contest.problems.includes(problemId)) {
    throw new Response("Problem not found in this contest", { status: 404 });
  }

  const problem = await getProblem(problemId);
  if (!problem) {
    throw new Response("Problem not found", { status: 404 });
  }

  // Check if user can submit (contest active)
  const contestStatus = await isUserInActiveContest(session.username, contestId);

  // Get user's submissions for this problem
  const submissions = await getSubmissionsByUserAndProblem(session.username, problemId);

  // Build subtasks info
  const subtasks = problem.subtaskScores.map((score: number, index: number) => ({
    id: index + 1,
    score,
    constraints: problem.subtaskDependency?.[index] || `Testcases ${index + 1}`,
  }));

  return {
    contest,
    problem,
    user: session,
    canSubmit: contestStatus.active,
    submissions: submissions.slice(0, 10), // Latest 10 submissions
    maxScore: problem.subtaskScores.reduce((sum: number, s: number) => sum + s, 0),
    subtasks,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { contestId, problemId } = params;

  if (!contestId || !problemId) {
    throw new Response("Contest ID and Problem ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const session = await requireContestAccess(request, contestId);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "submit") {
    const { submitSolution } = await import("~/lib/submissions.server");
    const { getProblem } = await import("~/lib/db/problems.server");

    const code = formData.get("code") as string;
    const codeA = formData.get("codeA") as string;
    const codeB = formData.get("codeB") as string;
    const language = formData.get("language") as string;

    if (!["cpp", "py", "java"].includes(language)) {
      return { error: "Invalid language selected" };
    }

    const problem = await getProblem(problemId);
    if (!problem) {
      return { error: "Problem not found" };
    }

    // Validate based on problem type
    if (problem.problem_type === "Communication") {
      if (!codeA?.trim() || !codeB?.trim()) {
        return { error: "Both source files are required" };
      }
    } else {
      if (!code?.trim()) {
        return { error: "Code cannot be empty" };
      }
    }

    try {
      const submission = await submitSolution({
        username: session.username,
        problemName: problemId,
        language,
        code: problem.problem_type === "Communication" ? undefined : code,
        codeA: problem.problem_type === "Communication" ? codeA : undefined,
        codeB: problem.problem_type === "Communication" ? codeB : undefined,
        contestId,
      });

      return {
        success: true,
        submissionId: submission.subId,
        message: `Submission #${submission.subId} queued for grading!`
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to submit solution"
      };
    }
  }

  return { error: "Invalid action" };
}

function ProblemStatement({ problemId }: { problemId: string }) {
  const [statement, setStatement] = useState<{
    format: "html" | "pdf";
    content?: string;
    url?: string;
    attachmentUrl?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/problems/${problemId}/statement?format=auto`)
      .then(res => res.json())
      .then(data => setStatement(data))
      .catch(() => setStatement({ error: "Failed to load problem statement", format: "html" }));
  }, [problemId]);

  if (!statement) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (statement.error) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center text-gray-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>{statement.error}</p>
        </div>
      </div>
    );
  }

  if (statement.format === "html" && statement.content) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: statement.content }}
          />
        </div>
        {statement.attachmentUrl && (
          <div className="border-t p-4 bg-gray-50">
            <Button asChild size="sm" variant="outline">
              <a href={statement.attachmentUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Attachments
              </a>
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (statement.format === "pdf" && statement.url) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center space-y-4">
          <div className="text-gray-600">
            <Eye className="h-8 w-8 mx-auto mb-2" />
            <p>Problem statement is available as PDF</p>
          </div>
          <div className="space-x-2">
            <Button asChild>
              <a href={statement.url} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                View PDF
              </a>
            </Button>
            {statement.attachmentUrl && (
              <Button asChild variant="outline">
                <a href={statement.attachmentUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Attachments
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="text-center text-gray-600">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>Problem statement not available</p>
      </div>
    </div>
  );
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
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
};

export default function ContestProblem({ loaderData, actionData }: Route.ComponentProps) {
  const { contest, problem, user, canSubmit, submissions, maxScore, subtasks } = loaderData;
  const [code, setCode] = useState("");
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
  const [language, setLanguage] = useState("cpp");
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const isCommunication = problem.problem_type === "Communication";

  useContestWebSocket(contest.contestId);

  // Redirect to submission page after successful submit
  useEffect(() => {
    if (actionData?.success && actionData?.submissionId) {
      navigate(`/submissions/${actionData.submissionId}`);
    }
  }, [actionData, navigate]);

  // Auto-refresh submissions if any are still grading
  useEffect(() => {
    const hasGrading = submissions.some((s: any) => !s.gradingCompleteTime);
    if (!hasGrading) return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 2000);

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
    if (submission.totalScore === maxScore) return "AC";
    if (submission.totalScore === 0) return "WA";
    return "PS";
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
        <Link to={`/contests/${contest.contestId}/problems`} className="hover:text-emerald-600">
          Problems
        </Link>
        <span>/</span>
        <span>{problem.title || problem.problemName}</span>
      </div>

      {/* Problem Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {problem.title || problem.problemName}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Time Limit: {problem.timeLimit}s
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              Memory: {problem.memoryLimit}MB
            </span>
            <span>Max Score: {maxScore}</span>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Problem Statement & Subtasks */}
        <div className="space-y-6">
          <ProblemStatement problemId={problem.problemName} />

          {/* Subtasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subtasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subtasks.map((subtask: any) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        Subtask {subtask.id}
                      </div>
                      <div className="text-xs text-gray-600">
                        {subtask.constraints}
                      </div>
                    </div>
                    <Badge variant="outline">{subtask.score} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Submit & Submissions */}
        <div className="space-y-6">
          {/* Submit Solution */}
          {canSubmit ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Submit Solution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {actionData?.success && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-emerald-700 text-sm">{actionData.message}</p>
                  </div>
                )}

                {actionData?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">{actionData.error}</p>
                  </div>
                )}

                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="submit" />

                  <div>
                    <label className="block text-sm font-medium mb-2">Language</label>
                    <Select name="language" value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpp">C++ 17</SelectItem>
                        <SelectItem value="py">Python 3</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isCommunication ? (
                    <Tabs defaultValue="codeA" className="w-full">
                      <TabsList className="mb-2">
                        <TabsTrigger value="codeA">{problem.nameA || "File A"}</TabsTrigger>
                        <TabsTrigger value="codeB">{problem.nameB || "File B"}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="codeA">
                        <Textarea
                          name="codeA"
                          value={codeA}
                          onChange={(e) => setCodeA(e.target.value)}
                          placeholder={`Enter ${problem.nameA || "File A"} code here...`}
                          className="font-mono text-sm min-h-[300px]"
                        />
                      </TabsContent>
                      <TabsContent value="codeB">
                        <Textarea
                          name="codeB"
                          value={codeB}
                          onChange={(e) => setCodeB(e.target.value)}
                          placeholder={`Enter ${problem.nameB || "File B"} code here...`}
                          className="font-mono text-sm min-h-[300px]"
                        />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-2">Source Code</label>
                      <Textarea
                        name="code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Enter your solution here..."
                        className="font-mono text-sm min-h-[300px]"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isCommunication ? (!codeA.trim() || !codeB.trim()) : !code.trim()}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Solution
                  </Button>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-gray-600">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>Contest is not active. Cannot submit solutions.</p>
              </CardContent>
            </Card>
          )}

          {/* My Submissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  My Submissions
                </span>
                <Badge variant="outline">{submissions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-6 text-gray-600">
                  <Code2 className="h-8 w-8 mx-auto mb-2" />
                  <p>No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((submission: any) => (
                    <div
                      key={submission.subId}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        {verdictIcon(getSubmissionVerdict(submission))}
                        <div>
                          <div className="font-medium">#{submission.subId}</div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(submission.submissionTime)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ScoreBadge
                          verdict={getSubmissionVerdict(submission) as VerdictType}
                          score={submission.totalScore}
                        />
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/submissions/${submission.subId}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}