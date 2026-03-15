import { data, redirect, Form } from "react-router";
import type { Route } from "./+types/problems";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ProblemManagementTable } from "~/components/admin/problem-management-table";
import { listProblems, createProblem } from "~/lib/db/problems.server";
import type { ProblemListItem } from "~/types/problem";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Problem Management - Codebreaker Admin" },
    { name: "description", content: "Manage problems in the Codebreaker Contest Manager" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const problems = await listProblems();

  // Map database problems to display format
  // Compute validated from verdicts to ensure consistency
  const problemList: ProblemListItem[] = problems.map((p) => {
    const verdicts = p.verdicts || {};
    const validated = Object.keys(verdicts).length > 0 &&
      Object.values(verdicts).every((v) => v === 1);

    return {
      problemName: p.problemName,
      title: p.title || p.problemName,
      problem_type: p.problem_type,
      validated,
      yourScore: 0, // Admin doesn't have scores
    };
  });

  return { problems: problemList };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const problemId = formData.get("problemId") as string;

  if (!problemId || !/^[a-zA-Z0-9_]+$/.test(problemId)) {
    return data({ error: "Invalid problem ID" }, { status: 400 });
  }

  try {
    await createProblem(problemId, { title: problemId });
    return redirect(`/admin/editproblem/${problemId}`);
  } catch (error) {
    return data({ error: "Problem ID already exists" }, { status: 400 });
  }
}

export default function AdminProblemsPage({ loaderData }: Route.ComponentProps) {
  const { problems } = loaderData;
  const handleAddProblem = (problemId: string) => {
    // Submit via form action to create problem in database
    const form = document.createElement("form");
    form.method = "POST";
    const input = document.createElement("input");
    input.name = "problemId";
    input.value = problemId;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Problem Management</h1>
        <p className="text-muted-foreground">
          Add, edit, and manage contest problems.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Problems</CardTitle>
          <CardDescription>
            A list of all problems including their validation status and type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProblemManagementTable
            data={problems}
            onAddProblem={handleAddProblem}
          />
        </CardContent>
      </Card>
    </div>
  );
}
