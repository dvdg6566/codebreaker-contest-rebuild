import type { Route } from "./+types/contests.$contestId.scoreboard";
import { Link } from "react-router";
import { requireContestAccess } from "~/lib/auth.server";
import { getContest } from "~/lib/contest.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  return {
    contest,
    user: session,
  };
}

export default function ContestScoreboard({ loaderData }: Route.ComponentProps) {
  const { contest, user } = loaderData;

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
        <span>Scoreboard</span>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900">
        {contest.contestName} - Scoreboard
      </h1>

      {/* Scoreboard Content */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">
          Contest rankings and participant standings will be displayed when the scoreboard feature is implemented.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          The scoreboard will show real-time rankings, problem solve counts, and total scores for all participants.
        </p>
      </div>
    </div>
  );
}