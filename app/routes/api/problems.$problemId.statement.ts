/**
 * Problem Statement API
 *
 * Serves problem statements (HTML inline, PDF as presigned URL).
 */

import type { Route } from "./+types/problems.$problemId.statement";
import {
  getStatementHtml,
  getStatementUrl,
  checkStatementExists,
  getAttachmentUrl,
} from "~/lib/s3.server";
import { getProblem } from "~/lib/db/problems.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  await requireAuth(request);

  const problemName = params.problemId;

  // Verify problem exists
  const problem = await getProblem(problemName);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  // Check if problem is validated (unless admin)
  const { getCurrentUser } = await import("~/lib/auth.server");
  const user = await getCurrentUser(request);
  const isAdmin = user?.role === "admin";

  if (!problem.validated && !isAdmin) {
    return Response.json(
      { error: "Problem is not available" },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "auto";

  // Check what formats are available
  const available = await checkStatementExists(problemName);

  if (!available.html && !available.pdf) {
    return Response.json(
      { error: "No statement available for this problem" },
      { status: 404 }
    );
  }

  // Determine which format to serve
  let serveFormat: "html" | "pdf";
  if (format === "html" && available.html) {
    serveFormat = "html";
  } else if (format === "pdf" && available.pdf) {
    serveFormat = "pdf";
  } else if (format === "auto") {
    // Prefer HTML for inline display, fallback to PDF
    serveFormat = available.html ? "html" : "pdf";
  } else {
    return Response.json(
      { error: `Requested format '${format}' is not available` },
      { status: 404 }
    );
  }

  if (serveFormat === "html") {
    // Return HTML content inline
    const html = await getStatementHtml(problemName);
    if (!html) {
      return Response.json(
        { error: "Failed to retrieve statement" },
        { status: 500 }
      );
    }

    return Response.json({
      format: "html",
      content: html,
      available,
    });
  } else {
    // Return presigned URL for PDF
    const pdfUrl = await getStatementUrl(problemName, "pdf", 300); // 5 minute expiry
    if (!pdfUrl) {
      return Response.json(
        { error: "Failed to generate PDF URL" },
        { status: 500 }
      );
    }

    // Also include attachment URL if available
    let attachmentUrl: string | null = null;
    if (problem.attachments) {
      attachmentUrl = await getAttachmentUrl(problemName, 300);
    }

    return Response.json({
      format: "pdf",
      url: pdfUrl,
      attachmentUrl,
      available,
    });
  }
}
