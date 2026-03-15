import type { Route } from "./+types/contests.$contestId.clarifications";
import { Link, data } from "react-router";
import { useContestWebSocket } from "~/hooks/useContestWebSocket";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const { requireContestAccess } = await import("~/lib/auth.server");
  const { getContest } = await import("~/lib/contest.server");
  const { getClarificationsByUserAndContest } = await import("~/lib/db/clarifications.server");

  const session = await requireContestAccess(request, contestId);
  const contest = await getContest(contestId);

  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  // Get user's clarifications for this contest
  const clarifications = await getClarificationsByUserAndContest(session.username, contestId);

  return {
    contest,
    user: session,
    clarifications,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { contestId } = params;

  if (!contestId) {
    throw new Response("Contest ID required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const { requireContestAccess } = await import("~/lib/auth.server");
    const { createClarification } = await import("~/lib/db/clarifications.server");
    const { postClarification } = await import("~/lib/websocket-broadcast.server");

    const session = await requireContestAccess(request, contestId);

    const question = formData.get("question") as string;
    const problemName = formData.get("problemName") as string;

    if (!question?.trim()) {
      return data({ error: "Question is required" }, { status: 400 });
    }

    await createClarification(
      session.username,
      question.trim(),
      contestId,
      problemName || undefined
    );

    // Notify admins of new clarification
    await postClarification();

    return { success: true };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function ContestClarifications({ loaderData }: Route.ComponentProps) {
  const { contest, user, clarifications } = loaderData;

  useContestWebSocket(contest.contestId);

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
        <span>Clarifications</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {contest.contestName} - Clarifications
        </h1>
      </div>

      {/* Ask Question Form */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Ask a Question</h2>
        <form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />

          <div>
            <label htmlFor="problemName" className="block text-sm font-medium text-gray-700 mb-1">
              Problem (optional)
            </label>
            <select
              name="problemName"
              id="problemName"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">General question</option>
              {contest.problems.map((problemName) => (
                <option key={problemName} value={problemName}>
                  {problemName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
              Question *
            </label>
            <textarea
              name="question"
              id="question"
              required
              rows={4}
              placeholder="Ask your question about the problem statement or contest rules..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Submit Question
          </button>
        </form>
      </div>

      {/* Clarifications List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Questions</h2>

        {clarifications.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <div className="text-gray-400 mb-4">
              <span className="text-4xl">❓</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Questions Yet</h3>
            <p className="text-gray-600">
              You haven't asked any questions for this contest. Use the form above to ask clarifications about problems or contest rules.
            </p>
          </div>
        ) : (
          clarifications.map((clarification) => (
            <div key={`${clarification.askedBy}:${clarification.clarificationTime}`} className="bg-white rounded-lg border shadow-sm">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${clarification.answer ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <div>
                      <div className="text-sm text-gray-500">
                        {clarification.problemName ? `Problem: ${clarification.problemName}` : 'General question'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {clarification.clarificationTime}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    clarification.answer
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {clarification.answer ? 'Answered' : 'Pending'}
                  </span>
                </div>

                {/* Question */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Your Question:</div>
                  <div className="text-gray-900">{clarification.question}</div>
                </div>

                {/* Answer */}
                {clarification.answer && (
                  <div className="bg-emerald-50 rounded-lg p-4 border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-emerald-700">Official Answer:</div>
                      {clarification.answeredBy && (
                        <div className="text-xs text-gray-500">
                          by {clarification.answeredBy}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-900">{clarification.answer}</div>
                  </div>
                )}

                {!clarification.answer && (
                  <div className="text-sm text-gray-500 italic">
                    Waiting for organizer response...
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}