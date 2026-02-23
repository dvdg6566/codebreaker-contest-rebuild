import { useNavigate } from "react-router";
import type { Route } from "./+types/problems";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ProblemManagementTable,
  sampleProblems,
} from "~/components/admin/problem-management-table";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Problem Management - Codebreaker Admin" },
    { name: "description", content: "Manage problems in the Codebreaker Contest Manager" },
  ];
}

export default function AdminProblemsPage() {
  const navigate = useNavigate();

  const handleAddProblem = (problemId: string) => {
    // In a real app, this would create the problem via API
    // then navigate to the edit page
    console.log("Creating problem:", problemId);
    navigate(`/admin/problems/${problemId}`);
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
            data={sampleProblems}
            onAddProblem={handleAddProblem}
          />
        </CardContent>
      </Card>
    </div>
  );
}
