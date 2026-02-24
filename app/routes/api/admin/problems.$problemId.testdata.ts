/**
 * Testdata Management API
 *
 * GET: List testcases with presigned URLs, or get STS credentials
 * POST: Upload testcase files or ZIP
 * DELETE: Remove testcases
 */

import type { Route } from "./+types/problems.$problemId.testdata";
import {
  listTestcases,
  getTestcaseUrls,
  uploadTestcaseFile,
  deleteTestcase,
  countTestcases,
} from "~/lib/s3.server";
import { uploadTestcasesFromZip, validateTestcases } from "~/lib/testdata.server";
import { getProblem, updateProblem } from "~/lib/db/problems.server";
import { getTestdataUploadCredentials } from "~/lib/sts.server";

/**
 * GET: List all testcases for a problem, or get STS credentials for direct upload
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin, getCurrentUser } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const problemName = params.problemId;

  // Verify problem exists
  const problem = await getProblem(problemName);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const intent = url.searchParams.get("intent");

  // Handle STS credentials request for direct S3 upload
  if (intent === "getCredentials") {
    const session = await getCurrentUser(request);
    const username = session?.username || "admin";

    try {
      const credentials = await getTestdataUploadCredentials(problemName, username);
      return Response.json(credentials);
    } catch (error) {
      console.error("Failed to get upload credentials:", error);
      return Response.json(
        { error: "Failed to get upload credentials" },
        { status: 500 }
      );
    }
  }

  const withUrls = url.searchParams.get("withUrls") === "true";

  // List testcases
  const testcases = await listTestcases(problemName);

  // Optionally fetch presigned URLs for each testcase
  if (withUrls) {
    const testcasesWithUrls = await Promise.all(
      testcases.map(async (tc) => {
        const urls = await getTestcaseUrls(problemName, tc.number);
        return {
          ...tc,
          urls,
        };
      })
    );

    return Response.json({
      problemName,
      testcaseCount: problem.testcaseCount,
      testcases: testcasesWithUrls,
    });
  }

  return Response.json({
    problemName,
    testcaseCount: problem.testcaseCount,
    testcases,
  });
}

/**
 * POST: Upload testcase files
 */
export async function action({ request, params }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const problemName = params.problemId;

  // Verify problem exists
  const problem = await getProblem(problemName);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    const uploadType = formData.get("uploadType") as string;

    if (uploadType === "zip") {
      // Handle ZIP upload
      const file = formData.get("file") as File | null;
      if (!file) {
        return Response.json({ error: "file is required" }, { status: 400 });
      }

      const replace = formData.get("replace") === "true";
      const renumber = formData.get("renumber") === "true";

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadTestcasesFromZip(problemName, buffer, {
        replace,
        renumber,
      });

      return Response.json(result);
    } else if (uploadType === "single") {
      // Handle single testcase upload
      const number = parseInt(formData.get("number") as string, 10);
      const inputFile = formData.get("input") as File | null;
      const outputFile = formData.get("output") as File | null;

      if (isNaN(number) || number < 1) {
        return Response.json(
          { error: "Valid testcase number is required" },
          { status: 400 }
        );
      }

      if (!inputFile || !outputFile) {
        return Response.json(
          { error: "Both input and output files are required" },
          { status: 400 }
        );
      }

      const inputBuffer = Buffer.from(await inputFile.arrayBuffer());
      const outputBuffer = Buffer.from(await outputFile.arrayBuffer());

      await Promise.all([
        uploadTestcaseFile(problemName, number, "in", inputBuffer),
        uploadTestcaseFile(problemName, number, "out", outputBuffer),
      ]);

      // Update testcaseCount if needed
      const currentCount = await countTestcases(problemName);
      if (currentCount > problem.testcaseCount) {
        await updateProblem(problemName, { testcaseCount: currentCount });
      }

      return Response.json({
        success: true,
        testcase: number,
      });
    } else if (uploadType === "file") {
      // Handle individual file upload (.in or .out)
      const number = parseInt(formData.get("number") as string, 10);
      const fileType = formData.get("fileType") as "in" | "out";
      const file = formData.get("file") as File | null;

      if (isNaN(number) || number < 1) {
        return Response.json(
          { error: "Valid testcase number is required" },
          { status: 400 }
        );
      }

      if (fileType !== "in" && fileType !== "out") {
        return Response.json(
          { error: "fileType must be 'in' or 'out'" },
          { status: 400 }
        );
      }

      if (!file) {
        return Response.json({ error: "file is required" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadTestcaseFile(problemName, number, fileType, buffer);

      return Response.json({
        success: true,
        testcase: number,
        type: fileType,
      });
    }

    return Response.json({ error: "Invalid uploadType" }, { status: 400 });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    const { testcases: testcaseNumbers } = body as { testcases: number[] };

    if (!Array.isArray(testcaseNumbers) || testcaseNumbers.length === 0) {
      return Response.json(
        { error: "testcases array is required" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      testcaseNumbers.map((num) => deleteTestcase(problemName, num))
    );

    const deleted = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Update testcaseCount
    const currentCount = await countTestcases(problemName);
    await updateProblem(problemName, { testcaseCount: currentCount });

    return Response.json({
      success: failed === 0,
      deleted,
      failed,
    });
  }

  if (request.method === "PUT") {
    // Validate testcases
    const body = await request.json();
    const action = body.action as string;

    if (action === "validate") {
      const validation = await validateTestcases(
        problemName,
        problem.testcaseCount
      );

      return Response.json({
        problemName,
        expectedCount: problem.testcaseCount,
        ...validation,
      });
    }

    if (action === "updateCount") {
      // Recount testcases and update problem
      const actualCount = await countTestcases(problemName);
      await updateProblem(problemName, { testcaseCount: actualCount });

      return Response.json({
        success: true,
        testcaseCount: actualCount,
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  return new Response("Method not allowed", { status: 405 });
}
