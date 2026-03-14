import type { Route } from "./+types/contests.$contestId.announcements";
import { Link } from "react-router";
import { loadContestRoute } from "~/lib/contest-route-helpers";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;
  const { session, contest } = await loadContestRoute(request, contestId!);

  return {
    contest,
    user: session,
  };
}

export default function ContestAnnouncements({ loaderData }: Route.ComponentProps) {
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
        <span>Announcements</span>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900">
        {contest.contestName} - Announcements
      </h1>

      {/* Announcements Content */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">
          Important updates and announcements for this contest will be displayed when available.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Contest organizers can post announcements here to communicate with all participants.
        </p>
      </div>
    </div>
  );
}