import type { Route } from "./+types/submissions";
import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { FileCode } from "lucide-react";
import type { Problem } from "~/types/database";
import {
  SubmissionManagementTable,
  type SubmissionRow,
} from "~/components/admin/submission-management-table";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "All Submissions - Admin" },
    { name: "description", content: "View all contest submissions" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { listSubmissions, getSubmissionVerdict } = await import("~/lib/db/submissions.server");
  const { listProblems } = await import("~/lib/db/problems.server");

  await requireAdmin(request);

  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;

  const [{ items: submissions, nextCursor }, problems] = await Promise.all([
    listSubmissions(500, cursor),
    listProblems(),
  ]);

  const problemMap = new Map<string, Problem>(
    problems.map((p) => [p.problemName, p])
  );

  const rows: SubmissionRow[] = submissions.map((sub) => {
    const problem = problemMap.get(sub.problemName);
    const maxScore = problem
      ? problem.subtaskScores.reduce((sum, s) => sum + s, 0)
      : 100;

    return {
      subId: sub.subId,
      username: sub.username,
      problemName: sub.problemName,
      problemTitle: problem?.title || sub.problemName,
      language: sub.language,
      languageDisplay:
        sub.language === "cpp"
          ? "C++ 17"
          : sub.language === "py"
          ? "Python 3"
          : sub.language === "java"
          ? "Java"
          : sub.language,
      verdict: getSubmissionVerdict(sub),
      score: sub.totalScore,
      maxScore,
      time: sub.gradingCompleteTime,
      contestId: sub.contestId || "unknown",
      contestDisplay: sub.contestId === "global" ? "Global/Admin" : (sub.contestId || "Unknown"),
      time: sub.gradingCompleteTime && sub.maxTime
        ? (sub.maxTime / 1000).toFixed(2)
        : "N/A",
      submissionTime: sub.submissionTime,
    };
  });

  return { rows, nextCursor };
}

export default function AdminSubmissions({ loaderData }: Route.ComponentProps) {
  const [rows, setRows] = useState<SubmissionRow[]>(loaderData.rows);
  const [nextCursor, setNextCursor] = useState<string | null>(loaderData.nextCursor);
  const fetcher = useFetcher<typeof loader>();

  useEffect(() => {
    if (fetcher.data) {
      setRows((prev) => [...prev, ...fetcher.data!.rows]);
      setNextCursor(fetcher.data.nextCursor);
    }
  }, [fetcher.data]);

  const loadMore = () => {
    if (nextCursor) {
      fetcher.load(`/admin/submissions?cursor=${nextCursor}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Submissions</h1>
          <p className="text-muted-foreground">
            Showing {rows.length} submission{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileCode className="h-5 w-5" />
          <span className="text-sm">All Problems</span>
        </div>
      </div>

      <SubmissionManagementTable data={rows} />

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={fetcher.state === "loading"}
          >
            {fetcher.state === "loading" ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
