/**
 * Problem File Download API
 *
 * GET: Generate presigned download URLs for problem files on-demand
 */

import type { Route } from "./+types/problems.$problemId.download";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const {
    getStatementUrl,
    getPresignedDownloadUrl,
    getAttachmentUrl,
    BucketNames,
  } = await import("~/lib/s3.server");

  await requireAdmin(request);

  const problemName = params.problemId;
  const url = new URL(request.url);
  const fileType = url.searchParams.get("type");
  const fileName = url.searchParams.get("name");

  // Presigned URLs valid for 5 minutes
  const expiresIn = 300;

  try {
    let downloadUrl: string | null = null;

    switch (fileType) {
      case "statement": {
        const format = fileName?.endsWith(".pdf") ? "pdf" : "html";
        downloadUrl = await getStatementUrl(problemName, format, expiresIn);
        break;
      }

      case "checker": {
        downloadUrl = await getPresignedDownloadUrl(
          BucketNames.checkers,
          `source/${problemName}.cpp`,
          expiresIn
        );
        break;
      }

      case "grader": {
        if (!fileName) {
          return Response.json({ error: "fileName required for grader" }, { status: 400 });
        }
        downloadUrl = await getPresignedDownloadUrl(
          BucketNames.graders,
          `${problemName}/${fileName}`,
          expiresIn
        );
        break;
      }

      case "attachment": {
        downloadUrl = await getAttachmentUrl(problemName, expiresIn);
        break;
      }

      default:
        return Response.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (!downloadUrl) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    return Response.json({ url: downloadUrl });
  } catch (error) {
    console.error("Failed to generate download URL:", error);
    return Response.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
