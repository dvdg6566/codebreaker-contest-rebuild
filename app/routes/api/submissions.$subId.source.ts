/**
 * Submission Source Code API
 *
 * Retrieves source code for a submission.
 * Auth-gated: User can only view own submissions OR admin.
 */

import type { Route } from "./+types/submissions.$subId.source";
import { getSubmission } from "~/lib/db/submissions.server";
import { getProblem } from "~/lib/db/problems.server";
import { getSubmissionSource, getCommunicationSource } from "~/lib/s3.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAuth, getCurrentUser } = await import("~/lib/auth.server");
  await requireAuth(request);

  const subId = parseInt(params.subId, 10);
  if (isNaN(subId)) {
    return Response.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  // Get submission
  const submission = await getSubmission(subId);
  if (!submission) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }

  // Check authorization
  const user = await getCurrentUser(request);
  const isAdmin = user?.role === "admin";
  const isOwner = user?.username === submission.username;

  if (!isAdmin && !isOwner) {
    return Response.json(
      { error: "You can only view your own submissions" },
      { status: 403 }
    );
  }

  // Get problem to check if Communication type
  const problem = await getProblem(submission.problemName);
  const isCommunication = problem?.problem_type === "Communication";

  if (isCommunication) {
    // Get both source files for Communication problems
    const { codeA, codeB } = await getCommunicationSource(
      subId,
      submission.language
    );

    if (!codeA && !codeB) {
      return Response.json(
        { error: "Source code not found" },
        { status: 404 }
      );
    }

    return Response.json({
      subId,
      problemName: submission.problemName,
      language: submission.language,
      type: "communication",
      sources: {
        [problem?.nameA || "A"]: codeA,
        [problem?.nameB || "B"]: codeB,
      },
    });
  } else {
    // Get single source file
    const code = await getSubmissionSource(subId, submission.language);

    if (!code) {
      return Response.json(
        { error: "Source code not found" },
        { status: 404 }
      );
    }

    return Response.json({
      subId,
      problemName: submission.problemName,
      language: submission.language,
      type: "single",
      code,
    });
  }
}
