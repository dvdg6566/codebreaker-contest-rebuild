import type { Route } from "./+types/contests.$contestId.problems.$problemId";
import { Link, redirect } from "react-router";
import { requireContestAccess } from "~/lib/auth.server";
import { getContest } from "~/lib/contest.server";
import { getProblem } from "~/lib/db/problems.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId, problemId } = params;

  if (!contestId || !problemId) {
    throw new Response("Contest ID and Problem ID required", { status: 400 });
  }

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

  return {
    contest,
    problem,
    user: session,
  };
}

export default function ContestProblem({ loaderData }: Route.ComponentProps) {
  const { contest, problem, user } = loaderData;

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
            <span>Time Limit: {problem.timeLimit}s</span>
            <span>Memory Limit: {problem.memoryLimit}MB</span>
            <span>Max Score: {problem.subtaskScores.reduce((sum: number, s: number) => sum + s, 0)}</span>
          </div>
        </div>
      </div>

      {/* Problem Content */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">
          Problem statement will be loaded here. This is a placeholder for the actual problem content.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Note: In a full implementation, this would fetch and display the problem statement PDF or HTML content.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Link to={`/contests/${contest.contestId}/problems`}>
          <button className="px-4 py-2 text-emerald-600 border border-emerald-600 rounded hover:bg-emerald-50">
            ← Back to Problems
          </button>
        </Link>
      </div>
    </div>
  );
}