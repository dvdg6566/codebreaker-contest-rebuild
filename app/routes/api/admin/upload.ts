/**
 * Admin Upload API
 *
 * Handles file uploads for problem files (statements, checkers, graders, attachments).
 */

import type { Route } from "./+types/upload";
import {
  uploadStatement,
  uploadChecker,
  uploadGrader,
  uploadAttachment,
} from "~/lib/s3.server";
import { getProblem } from "~/lib/db/problems.server";

type UploadType = "statement" | "checker" | "grader" | "header" | "attachment";

interface UploadResult {
  success: boolean;
  key?: string;
  error?: string;
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();

    const problemName = formData.get("problemName") as string;
    const uploadType = formData.get("type") as UploadType;
    const file = formData.get("file") as File | null;

    // Validate required fields
    if (!problemName) {
      return Response.json(
        { error: "problemName is required" },
        { status: 400 }
      );
    }

    if (!uploadType) {
      return Response.json({ error: "type is required" }, { status: 400 });
    }

    if (!file) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    // Verify problem exists
    const problem = await getProblem(problemName);
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    let result: UploadResult;

    switch (uploadType) {
      case "statement": {
        // Determine format from file extension
        const ext = file.name.toLowerCase().split(".").pop();
        if (ext !== "html" && ext !== "pdf") {
          return Response.json(
            { error: "Statement must be .html or .pdf" },
            { status: 400 }
          );
        }
        const key = await uploadStatement(
          problemName,
          buffer,
          ext as "html" | "pdf"
        );
        result = { success: true, key };
        break;
      }

      case "checker": {
        if (!file.name.toLowerCase().endsWith(".cpp")) {
          return Response.json(
            { error: "Checker must be a .cpp file" },
            { status: 400 }
          );
        }
        const key = await uploadChecker(problemName, buffer);
        result = { success: true, key };
        break;
      }

      case "grader": {
        if (!file.name.toLowerCase().endsWith(".cpp")) {
          return Response.json(
            { error: "Grader must be a .cpp file" },
            { status: 400 }
          );
        }
        const key = await uploadGrader(problemName, "grader.cpp", buffer);
        result = { success: true, key };
        break;
      }

      case "header": {
        // Header file can be for Interactive or Communication problems
        const filename = formData.get("filename") as string;
        if (!filename) {
          return Response.json(
            { error: "filename is required for header uploads" },
            { status: 400 }
          );
        }
        if (!filename.toLowerCase().endsWith(".h")) {
          return Response.json(
            { error: "Header must be a .h file" },
            { status: 400 }
          );
        }
        const key = await uploadGrader(problemName, filename, buffer);
        result = { success: true, key };
        break;
      }

      case "attachment": {
        if (!file.name.toLowerCase().endsWith(".zip")) {
          return Response.json(
            { error: "Attachment must be a .zip file" },
            { status: 400 }
          );
        }
        const key = await uploadAttachment(problemName, buffer);
        result = { success: true, key };
        break;
      }

      default:
        return Response.json(
          { error: `Unknown upload type: ${uploadType}` },
          { status: 400 }
        );
    }

    return Response.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check upload status / get file info
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const url = new URL(request.url);
  const problemName = url.searchParams.get("problemName");

  if (!problemName) {
    return Response.json(
      { error: "problemName is required" },
      { status: 400 }
    );
  }

  // Import file check functions
  const {
    checkStatementExists,
    checkerSourceExists,
    checkerIsCompiled,
    graderExists,
    listGraderFiles,
    attachmentExists,
  } = await import("~/lib/s3.server");

  const problem = await getProblem(problemName);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  // Check what files exist
  const [statement, checkerSource, checkerCompiled, grader, graderFiles, attachment] =
    await Promise.all([
      checkStatementExists(problemName),
      problem.customChecker ? checkerSourceExists(problemName) : Promise.resolve(false),
      problem.customChecker ? checkerIsCompiled(problemName) : Promise.resolve(false),
      problem.problem_type !== "Batch" ? graderExists(problemName) : Promise.resolve(false),
      problem.problem_type !== "Batch" ? listGraderFiles(problemName) : Promise.resolve([]),
      problem.attachments ? attachmentExists(problemName) : Promise.resolve(false),
    ]);

  return Response.json({
    problemName,
    files: {
      statement,
      checker: {
        required: problem.customChecker,
        sourceExists: checkerSource,
        compiled: checkerCompiled,
      },
      grader: {
        required: problem.problem_type !== "Batch",
        exists: grader,
        files: graderFiles,
      },
      attachment: {
        required: problem.attachments,
        exists: attachment,
      },
    },
  });
}
