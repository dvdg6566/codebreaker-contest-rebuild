import * as React from "react";
import type { Route } from "./+types/problem.$problemId";
import { Link, useFetcher } from "react-router";
import {
  FileText,
  Clock,
  HardDrive,
  Upload,
  ChevronLeft,
  Download,
  Code2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Edit,
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
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Problem ${params.problemId} - Codebreaker Contest` },
    { name: "description", content: "View problem details and submit solution" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAuth, requireAdmin } = await import("~/lib/auth.server");
  const { getProblem } = await import("~/lib/db/problems.server");
  const { getSubmissionsByUserAndProblem, getSubmissionVerdict, getBestSubmission } = await import("~/lib/db/submissions.server");
  const { getStatementHtml, getAttachmentUrl } = await import("~/lib/s3.server");
  const { getLanguageOptions } = await import("~/lib/languages");

  const session = await requireAuth(request);

  // Admin-only access for global problem testing
  await requireAdmin(request);

  const problemName = params.problemId;
  const problem = await getProblem(problemName);

  if (!problem) {
    throw new Response("Problem not found", { status: 404 });
  }

  // Get statement from S3 (check both HTML and PDF)
  const { getStatementUrl, checkStatementExists } = await import("~/lib/s3.server");

  let statementHtml = await getStatementHtml(problemName);
  let statementPdfUrl: string | null = null;

  // If no HTML statement, check for PDF
  if (!statementHtml) {
    const statementFormats = await checkStatementExists(problemName);
    if (statementFormats.pdf) {
      // Use longer expiration (1 hour) for reading statements
      statementPdfUrl = await getStatementUrl(problemName, "pdf", 3600);
    }
  }

  // Get user's submissions for this problem
  const userSubmissions = await getSubmissionsByUserAndProblem(session.username, problemName);

  // Get best submission
  const bestSubmission = await getBestSubmission(session.username, problemName);
  const userScore = bestSubmission?.totalScore || 0;

  // Get recent submissions (last 5)
  const recentSubmissions = userSubmissions.slice(0, 5).map((sub) => {
    const languageDisplay =
      sub.language === "cpp"
        ? "C++ 17"
        : sub.language === "py"
        ? "Python 3"
        : sub.language === "java"
        ? "Java"
        : sub.language;

    return {
      id: sub.subId,
      verdict: getSubmissionVerdict(sub),
      score: sub.totalScore,
      time: sub.gradingCompleteTime ? (sub.maxTime / 1000).toFixed(2) + "s" : "N/A",
      language: languageDisplay,
    };
  });

  // Build subtasks info
  const subtasks = problem.subtaskScores.map((score, index) => ({
    id: index + 1,
    score,
    constraints: problem.subtaskDependency?.[index] || `Testcases ${index + 1}`,
  }));

  // Get attachment URL if available
  const attachmentUrl = problem.attachments ? await getAttachmentUrl(problemName) : null;

  // Calculate max score
  const maxScore = problem.subtaskScores.reduce((sum, s) => sum + s, 0);

  return {
    problemData: {
      id: problem.problemName,
      name: problem.problemName,
      title: problem.title,
      author: "admin", // Not stored in DB
      source: problem.source || "",
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
      score: userScore,
      maxScore,
      type: problem.problem_type,
      nameA: problem.nameA,
      nameB: problem.nameB,
      subtasks,
      statement: statementHtml,
      statementPdfUrl,
      attachmentUrl,
    },
    recentSubmissions,
    languages: getLanguageOptions(),
    username: session.username,
    isAdmin: session.role === "admin",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { requireAuth, requireAdmin } = await import("~/lib/auth.server");

  // Admin-only access for global problem testing
  await requireAdmin(request);
  const { getProblem } = await import("~/lib/db/problems.server");
  const { canUserSubmit } = await import("~/lib/db/submissions.server");
  const { getLanguageIdFromName } = await import("~/lib/languages");
  const { getContest } = await import("~/lib/db/contests.server");

  const session = await requireAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "submit") {
    return { success: false, error: "Invalid intent" };
  }

  const problemName = params.problemId;
  const problem = await getProblem(problemName);

  if (!problem) {
    return { success: false, error: "Problem not found" };
  }

  if (!problem.validated) {
    return { success: false, error: "Problem is not ready for submissions" };
  }

  // Get user's contest settings for submission delay
  // Get submission delay from user's active contests (use minimum delay)
  const { getUserActiveContests } = await import("~/lib/db/users.server");
  const activeContests = await getUserActiveContests(session.username);
  let subDelay = 30; // Default delay

  if (Object.keys(activeContests).length > 0) {
    const contests = await Promise.all(
      Object.keys(activeContests).map(contestId => getContest(contestId))
    );
    // Use the minimum delay across all active contests (more permissive)
    const delays = contests.filter((c): c is NonNullable<typeof c> => c !== null).map(c => c.subDelay || 30);
    if (delays.length > 0) {
      subDelay = Math.min(...delays);
    }
  }

  // Check submission delay
  const { allowed, waitSeconds } = await canUserSubmit(session.username, problemName, subDelay);
  if (!allowed) {
    return { success: false, error: `Please wait ${waitSeconds} seconds before submitting again` };
  }

  // Get submission data
  const languageName = formData.get("language") as string;
  const code = formData.get("code") as string;
  const codeA = formData.get("codeA") as string;
  const codeB = formData.get("codeB") as string;

  // Convert language name to ID
  const language = getLanguageIdFromName(languageName);
  if (!language) {
    return { success: false, error: "Invalid language" };
  }

  // Submit for grading (admin global submission)
  const { submitSolution } = await import("~/lib/submissions.server");

  try {
    const submission = await submitSolution({
      username: session.username,
      problemName,
      language,
      code: problem.problem_type === "Communication" ? undefined : code,
      codeA: problem.problem_type === "Communication" ? codeA : undefined,
      codeB: problem.problem_type === "Communication" ? codeB : undefined,
      // No contestId = global admin submission
    });

    return {
      success: true,
      submissionId: submission.subId,
      message: `Submission #${submission.subId} queued for grading!`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit solution"
    };
  }
}

export default function ProblemDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { problemData, recentSubmissions, languages, username, isAdmin } = loaderData;
  const fetcher = useFetcher();
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>(languages[0]?.label || "C++ 17");
  const [code, setCode] = React.useState("");
  const [codeA, setCodeA] = React.useState("");
  const [codeB, setCodeB] = React.useState("");

  const isSubmitting = fetcher.state === "submitting";

  // Handle successful submission redirect
  React.useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.submissionId) {
      window.location.href = `/submissions/${fetcher.data.submissionId}`;
    }
  }, [fetcher.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("intent", "submit");
    formData.append("language", selectedLanguage);
    if (problemData.type === "Communication") {
      formData.append("codeA", codeA);
      formData.append("codeB", codeB);
    } else {
      formData.append("code", code);
    }
    fetcher.submit(formData, { method: "post" });
  };

  const verdictIcon = (verdict: string) => {
    switch (verdict) {
      case "AC":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "WA":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "TLE":
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/problems">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {problemData.title}
              </h1>
              {problemData.type === "Communication" && (
                <Badge variant="secondary">Communication</Badge>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/admin/editproblem/${problemData.id}`}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>Author: {problemData.author}</span>
              {problemData.source && <span>Source: {problemData.source}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {problemData.score}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {problemData.maxScore}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">Your Score</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Problem Statement */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Problem Statement</CardTitle>
            </CardHeader>
            <CardContent>
              {problemData.statement ? (
                <div className="prose prose-sm max-w-none">
                  <div
                    className="[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_p]:mb-3 [&_ul]:mb-3 [&_li]:mb-1 [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_code]:text-sm"
                    dangerouslySetInnerHTML={{ __html: problemData.statement }}
                  />
                </div>
              ) : problemData.statementPdfUrl ? (
                <div className="space-y-4">
                  <iframe
                    src={problemData.statementPdfUrl}
                    className="w-full h-[600px] border rounded-lg"
                    title="Problem Statement PDF"
                  />
                  <Button variant="outline" asChild>
                    <a href={problemData.statementPdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Open PDF in New Tab
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">No statement available for this problem.</p>
              )}
            </CardContent>
          </Card>

          {/* Submit Solution */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Submit Solution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fetcher.data?.error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {fetcher.data.error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.label}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {problemData.type === "Communication" ? (
                  <Tabs defaultValue="codeA">
                    <TabsList>
                      <TabsTrigger value="codeA">{problemData.nameA || "File A"}</TabsTrigger>
                      <TabsTrigger value="codeB">{problemData.nameB || "File B"}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="codeA" className="space-y-2">
                      <Label>{problemData.nameA || "File A"}</Label>
                      <Textarea
                        placeholder={`Paste your ${problemData.nameA || "File A"} code here...`}
                        className="font-mono text-sm min-h-[200px]"
                        value={codeA}
                        onChange={(e) => setCodeA(e.target.value)}
                      />
                    </TabsContent>
                    <TabsContent value="codeB" className="space-y-2">
                      <Label>{problemData.nameB || "File B"}</Label>
                      <Textarea
                        placeholder={`Paste your ${problemData.nameB || "File B"} code here...`}
                        className="font-mono text-sm min-h-[200px]"
                        value={codeB}
                        onChange={(e) => setCodeB(e.target.value)}
                      />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Textarea
                      placeholder="Paste your code here..."
                      className="font-mono text-sm min-h-[200px]"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Submit Solution
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Constraints */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Constraints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Time Limit
                  </div>
                  <span className="font-medium">{problemData.timeLimit}s</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    Memory Limit
                  </div>
                  <span className="font-medium">{problemData.memoryLimit} MB</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Subtasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {problemData.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        Subtask {subtask.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subtask.constraints}
                      </div>
                    </div>
                    <Badge variant="outline">{subtask.score} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Submissions</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/submissions?problem=${problemData.id}`}>
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentSubmissions.length > 0 ? (
                <div className="space-y-2">
                  {recentSubmissions.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/submissions/${sub.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {verdictIcon(sub.verdict)}
                        <div>
                          <div className="text-sm font-medium">#{sub.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {sub.language}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{sub.score}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.time}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No submissions yet</p>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {problemData.attachmentUrl && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href={problemData.attachmentUrl} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download Sample Files
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
