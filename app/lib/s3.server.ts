/**
 * S3 Client Configuration and Operations
 *
 * Provides S3 client and helper functions for file operations.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BucketNames } from "./db/dynamodb-client.server";

// Configuration from environment
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
};

// Create the S3 client
export const s3Client = new S3Client({
  region: config.region,
});

// Re-export bucket names for convenience
export { BucketNames };

// =============================================================================
// GENERIC S3 OPERATIONS
// =============================================================================

/**
 * Upload a file to S3
 */
export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<void> {
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
  };

  if (contentType) {
    params.ContentType = contentType;
  }

  await s3Client.send(new PutObjectCommand(params));
}

/**
 * Download a file from S3
 */
export async function downloadFile(
  bucket: string,
  key: string
): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for ${bucket}/${key}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Get a presigned URL for downloading a file
 */
export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn = 60
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a presigned URL for uploading a file
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType?: string,
  expiresIn = 3600
): Promise<string> {
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  if (contentType) {
    params.ContentType = contentType;
  }

  const command = new PutObjectCommand(params);
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFile(bucket: string, key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * List files in an S3 prefix
 */
export async function listFiles(
  bucket: string,
  prefix: string
): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  );

  return (response.Contents || [])
    .map((obj) => obj.Key)
    .filter((key): key is string => key !== undefined);
}

// =============================================================================
// STATEMENT OPERATIONS
// =============================================================================

/**
 * Upload a problem statement (HTML or PDF)
 */
export async function uploadStatement(
  problemName: string,
  content: Buffer | Uint8Array,
  format: "html" | "pdf"
): Promise<string> {
  const key = `${problemName}.${format}`;
  const contentType = format === "html" ? "text/html" : "application/pdf";

  await uploadFile(BucketNames.statements, key, content, contentType);
  return key;
}

/**
 * Get statement URL (presigned for PDF, direct content for HTML)
 */
export async function getStatementUrl(
  problemName: string,
  format: "html" | "pdf",
  expiresIn = 60
): Promise<string | null> {
  const key = `${problemName}.${format}`;
  const exists = await fileExists(BucketNames.statements, key);

  if (!exists) {
    return null;
  }

  return getPresignedDownloadUrl(BucketNames.statements, key, expiresIn);
}

/**
 * Get HTML statement content directly
 */
export async function getStatementHtml(
  problemName: string
): Promise<string | null> {
  const key = `${problemName}.html`;

  try {
    const buffer = await downloadFile(BucketNames.statements, key);
    return buffer.toString("utf-8");
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

/**
 * Check which statement formats exist for a problem
 */
export async function checkStatementExists(
  problemName: string
): Promise<{ html: boolean; pdf: boolean }> {
  const [htmlExists, pdfExists] = await Promise.all([
    fileExists(BucketNames.statements, `${problemName}.html`),
    fileExists(BucketNames.statements, `${problemName}.pdf`),
  ]);

  return { html: htmlExists, pdf: pdfExists };
}

// =============================================================================
// CHECKER OPERATIONS
// =============================================================================

/**
 * Upload a custom checker source file
 */
export async function uploadChecker(
  problemName: string,
  content: Buffer | Uint8Array
): Promise<string> {
  const key = `source/${problemName}.cpp`;
  await uploadFile(BucketNames.checkers, key, content, "text/x-c++src");
  return key;
}

/**
 * Check if compiled checker exists
 */
export async function checkerIsCompiled(problemName: string): Promise<boolean> {
  return fileExists(BucketNames.checkers, `compiled/${problemName}`);
}

/**
 * Check if checker source exists
 */
export async function checkerSourceExists(problemName: string): Promise<boolean> {
  return fileExists(BucketNames.checkers, `source/${problemName}.cpp`);
}

// =============================================================================
// GRADER OPERATIONS
// =============================================================================

/**
 * Upload grader file (grader.cpp or header files)
 */
export async function uploadGrader(
  problemName: string,
  filename: string,
  content: Buffer | Uint8Array
): Promise<string> {
  const key = `${problemName}/${filename}`;
  const contentType = filename.endsWith(".cpp")
    ? "text/x-c++src"
    : filename.endsWith(".h")
    ? "text/x-c"
    : "application/octet-stream";

  await uploadFile(BucketNames.graders, key, content, contentType);
  return key;
}

/**
 * List grader files for a problem
 */
export async function listGraderFiles(problemName: string): Promise<string[]> {
  const keys = await listFiles(BucketNames.graders, `${problemName}/`);
  return keys.map((key) => key.replace(`${problemName}/`, ""));
}

/**
 * Check if grader exists for a problem
 */
export async function graderExists(problemName: string): Promise<boolean> {
  return fileExists(BucketNames.graders, `${problemName}/grader.cpp`);
}

// =============================================================================
// ATTACHMENT OPERATIONS
// =============================================================================

/**
 * Upload attachment ZIP
 */
export async function uploadAttachment(
  problemName: string,
  content: Buffer | Uint8Array
): Promise<string> {
  const key = `${problemName}.zip`;
  await uploadFile(BucketNames.attachments, key, content, "application/zip");
  return key;
}

/**
 * Get attachment download URL
 */
export async function getAttachmentUrl(
  problemName: string,
  expiresIn = 60
): Promise<string | null> {
  const key = `${problemName}.zip`;
  const exists = await fileExists(BucketNames.attachments, key);

  if (!exists) {
    return null;
  }

  return getPresignedDownloadUrl(BucketNames.attachments, key, expiresIn);
}

/**
 * Check if attachment exists
 */
export async function attachmentExists(problemName: string): Promise<boolean> {
  return fileExists(BucketNames.attachments, `${problemName}.zip`);
}

// =============================================================================
// TESTDATA OPERATIONS
// =============================================================================

/**
 * Upload a single testcase file (.in or .out)
 */
export async function uploadTestcaseFile(
  problemName: string,
  testcaseNumber: number,
  type: "in" | "out",
  content: Buffer | Uint8Array
): Promise<string> {
  const key = `${problemName}/${testcaseNumber}.${type}`;
  await uploadFile(BucketNames.testdata, key, content, "text/plain");
  return key;
}

/**
 * Upload multiple testcase files
 */
export async function uploadTestcases(
  problemName: string,
  testcases: Array<{
    number: number;
    input: Buffer | Uint8Array;
    output: Buffer | Uint8Array;
  }>
): Promise<void> {
  await Promise.all(
    testcases.flatMap((tc) => [
      uploadTestcaseFile(problemName, tc.number, "in", tc.input),
      uploadTestcaseFile(problemName, tc.number, "out", tc.output),
    ])
  );
}

/**
 * List testcase files for a problem
 */
export async function listTestcases(
  problemName: string
): Promise<{ number: number; hasInput: boolean; hasOutput: boolean }[]> {
  const keys = await listFiles(BucketNames.testdata, `${problemName}/`);

  const testcaseMap = new Map<number, { hasInput: boolean; hasOutput: boolean }>();

  for (const key of keys) {
    const filename = key.replace(`${problemName}/`, "");
    const match = filename.match(/^(\d+)\.(in|out)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const type = match[2] as "in" | "out";

      if (!testcaseMap.has(num)) {
        testcaseMap.set(num, { hasInput: false, hasOutput: false });
      }

      const tc = testcaseMap.get(num)!;
      if (type === "in") tc.hasInput = true;
      if (type === "out") tc.hasOutput = true;
    }
  }

  return Array.from(testcaseMap.entries())
    .map(([number, status]) => ({ number, ...status }))
    .sort((a, b) => a.number - b.number);
}

/**
 * Get presigned URLs for viewing testcase content
 */
export async function getTestcaseUrls(
  problemName: string,
  testcaseNumber: number,
  expiresIn = 60
): Promise<{ input: string | null; output: string | null }> {
  const [inputUrl, outputUrl] = await Promise.all([
    getPresignedDownloadUrl(
      BucketNames.testdata,
      `${problemName}/${testcaseNumber}.in`,
      expiresIn
    ).catch(() => null),
    getPresignedDownloadUrl(
      BucketNames.testdata,
      `${problemName}/${testcaseNumber}.out`,
      expiresIn
    ).catch(() => null),
  ]);

  return { input: inputUrl, output: outputUrl };
}

/**
 * Delete a testcase
 */
export async function deleteTestcase(
  problemName: string,
  testcaseNumber: number
): Promise<void> {
  await Promise.all([
    deleteFile(BucketNames.testdata, `${problemName}/${testcaseNumber}.in`),
    deleteFile(BucketNames.testdata, `${problemName}/${testcaseNumber}.out`),
  ]);
}

/**
 * Count testcases for a problem
 */
export async function countTestcases(problemName: string): Promise<number> {
  const testcases = await listTestcases(problemName);
  return testcases.filter((tc) => tc.hasInput && tc.hasOutput).length;
}

// =============================================================================
// SUBMISSION SOURCE OPERATIONS
// =============================================================================

/**
 * Get file extension for a language
 */
function getLanguageExtension(language: string): string {
  switch (language) {
    case "cpp":
      return "cpp";
    case "py":
      return "py";
    case "java":
      return "java";
    default:
      return language;
  }
}

/**
 * Upload submission source code
 */
export async function uploadSubmissionSource(
  subId: number,
  code: string,
  language: string
): Promise<string> {
  const ext = getLanguageExtension(language);
  const key = `source/${subId}.${ext}`;

  const contentType =
    language === "cpp"
      ? "text/x-c++src"
      : language === "py"
      ? "text/x-python"
      : language === "java"
      ? "text/x-java"
      : "text/plain";

  await uploadFile(BucketNames.submissions, key, code, contentType);
  return key;
}

/**
 * Upload Communication problem source files (A and B)
 */
export async function uploadCommunicationSource(
  subId: number,
  codeA: string,
  codeB: string,
  language: string
): Promise<{ keyA: string; keyB: string }> {
  const ext = getLanguageExtension(language);
  const keyA = `source/${subId}A.${ext}`;
  const keyB = `source/${subId}B.${ext}`;

  const contentType =
    language === "cpp"
      ? "text/x-c++src"
      : language === "py"
      ? "text/x-python"
      : "text/plain";

  await Promise.all([
    uploadFile(BucketNames.submissions, keyA, codeA, contentType),
    uploadFile(BucketNames.submissions, keyB, codeB, contentType),
  ]);

  return { keyA, keyB };
}

/**
 * Get submission source code
 */
export async function getSubmissionSource(
  subId: number,
  language: string
): Promise<string | null> {
  const ext = getLanguageExtension(language);
  const key = `source/${subId}.${ext}`;

  try {
    const buffer = await downloadFile(BucketNames.submissions, key);
    return buffer.toString("utf-8");
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

/**
 * Get Communication problem source files
 */
export async function getCommunicationSource(
  subId: number,
  language: string
): Promise<{ codeA: string | null; codeB: string | null }> {
  const ext = getLanguageExtension(language);

  const [codeA, codeB] = await Promise.all([
    downloadFile(BucketNames.submissions, `source/${subId}A.${ext}`)
      .then((buf) => buf.toString("utf-8"))
      .catch(() => null),
    downloadFile(BucketNames.submissions, `source/${subId}B.${ext}`)
      .then((buf) => buf.toString("utf-8"))
      .catch(() => null),
  ]);

  return { codeA, codeB };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { config };
