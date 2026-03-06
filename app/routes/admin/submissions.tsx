import type { Route } from "./+types/submissions";
import { FileCode } from "lucide-react";
import { listSubmissions, getSubmissionVerdict } from "~/lib/db/submissions.server";
import { listProblems } from "~/lib/db/problems.server";
import type { Problem } from "~/types/database";
import {
  SubmissionManagementTable,
  type SubmissionRow,
} from "~/components/admin/submission-management-table";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "All Submissions - Admin" },
    { name: "description", content: "View all contest submissions" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const [submissions, problems] = await Promise.all([
    listSubmissions(500),
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
      time: sub.gradingCompleteTime
        ? (sub.maxTime / 1000).toFixed(2)
        : "N/A",
      submissionTime: sub.submissionTime,
    };
  });

  return { rows };
}

export default function AdminSubmissions({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Submissions</h1>
          <p className="text-muted-foreground">
            {rows.length} submission{rows.length !== 1 ? "s" : ""} across all problems
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileCode className="h-5 w-5" />
          <span className="text-sm">Latest 500</span>
        </div>
      </div>

      <SubmissionManagementTable data={rows} />
    </div>
  );
}
