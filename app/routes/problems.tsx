import type { Route } from "./+types/problems";
import { Link } from "react-router";
import { Shield, Eye, CheckCircle2, XCircle, Clock, HardDrive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { listProblems } = await import("~/lib/db/problems.server");

  // This throws 403 if not admin
  await requireAdmin(request);

  const problems = await listProblems();

  return {
    problems,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Problems - Admin - Codebreaker Contest" },
    { name: "description", content: "Admin problem testing and management" },
  ];
}

export default function Problems({ loaderData }: Route.ComponentProps) {
  const { problems } = loaderData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-600" />
            Problems
          </h1>
          <p className="text-gray-600 mt-1">
            Admin-only problem testing and management
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-600 border-emerald-600">
          Admin Only
        </Badge>
      </div>

      {/* Problems Table */}
      {problems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Problems Available</h3>
            <p className="text-gray-600">
              No problems have been created yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Problem Library</CardTitle>
            <CardDescription>
              Test problems outside of contest context. Click on any problem to test it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Problem</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Constraints</TableHead>
                    <TableHead className="text-center">Max Score</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problems.map((problem) => {
                    const maxScore = problem.subtaskScores.reduce((sum: number, s: number) => sum + s, 0);

                    return (
                      <TableRow key={problem.problemName} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {problem.title || problem.problemName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {problem.problemName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {problem.problem_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {problem.validated ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-emerald-600 text-sm">Validated</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600 text-sm">Invalid</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm space-y-1">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-gray-500" />
                              <span>{problem.timeLimit}s</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <HardDrive className="h-3 w-3 text-gray-500" />
                              <span>{problem.memoryLimit}MB</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {maxScore}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button asChild size="sm">
                              <Link to={`/problems/${problem.problemName}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Test
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/admin/problems/${problem.problemName}`}>
                                Edit
                              </Link>
                            </Button>
                          </div>
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