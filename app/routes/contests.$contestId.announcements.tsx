import type { Route } from "./+types/contests.$contestId.announcements";
import { Link } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const { getContest } = await import("~/lib/contest.server");
  const { getAnnouncementsByContest } = await import("~/lib/db/announcements.server");

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  const announcements = await getAnnouncementsByContest(contestId);

  return {
    contest,
    user: session,
    announcements,
  };
}

export default function ContestAnnouncements({ loaderData }: Route.ComponentProps) {
  const { contest, user, announcements } = loaderData;

  const typeConfig = {
    important: {
      icon: "🚨",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-l-red-500",
    },
    update: {
      icon: "🔔",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-l-amber-500",
    },
    info: {
      icon: "ℹ️",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-l-blue-500",
    },
  };

  const getAnnouncementType = (priority?: "low" | "normal" | "high") => {
    if (priority === "high") return "important";
    if (priority === "low") return "info";
    return "update";
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
        <span>Announcements</span>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900">
        {contest.contestName} - Announcements
      </h1>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <div className="text-gray-400 mb-4">
              <span className="text-4xl">📢</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Announcements Yet</h3>
            <p className="text-gray-600">
              Contest organizers haven't posted any announcements for this contest.
            </p>
          </div>
        ) : (
          announcements.map((announcement) => {
            const type = getAnnouncementType(announcement.priority);
            const config = typeConfig[type];

            return (
              <div
                key={announcement.announcementId}
                className={`bg-white rounded-lg border-l-4 ${config.borderColor} shadow-sm`}
              >
                <div className={`p-4 ${config.bgColor}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {announcement.title}
                        </h3>
                        <div className="text-sm text-gray-500">
                          {announcement.announcementTime}
                        </div>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line">
                        {announcement.text}
                      </p>
                      {announcement.author && (
                        <div className="mt-3 text-sm text-gray-500">
                          Posted by {announcement.author}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}