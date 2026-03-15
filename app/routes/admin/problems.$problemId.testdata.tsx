import * as React from "react";
import { Link, useParams, useRevalidator } from "react-router";
import type { Route } from "./+types/problems.$problemId.testdata";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Files,
  Loader2,
  Download,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface Testcase {
  number: number;
  hasInput: boolean;
  hasOutput: boolean;
  urls?: {
    input: string | null;
    output: string | null;
  };
}

interface UploadCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  bucket: string;
  region: string;
  problemName: string;
}

interface FileUploadStatus {
  filename: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Testdata: ${params.problemId} - Codebreaker Admin` },
    { name: "description", content: `Manage testdata for ${params.problemId}` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const { getProblem } = await import("~/lib/db/problems.server");
  const problem = await getProblem(params.problemId);

  if (!problem) {
    throw new Response("Problem not found", { status: 404 });
  }

  // Fetch testcases from API
  const { listTestcases } = await import("~/lib/s3.server");
  const testcases = await listTestcases(params.problemId);

  return {
    problem,
    testcases,
  };
}

export default function TestdataPage({ loaderData }: Route.ComponentProps) {
  const { problem, testcases: initialTestcases } = loaderData;
  const params = useParams();
  const revalidator = useRevalidator();
  const problemId = params.problemId as string;

  const [testcases, setTestcases] = React.useState<Testcase[]>(initialTestcases);
  const [selectedTestcases, setSelectedTestcases] = React.useState<Set<number>>(
    new Set()
  );
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Direct upload state
  const [credentials, setCredentials] = React.useState<UploadCredentials | null>(null);
  const [credentialsLoading, setCredentialsLoading] = React.useState(false);
  const [credentialsError, setCredentialsError] = React.useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [fileUploadStatuses, setFileUploadStatuses] = React.useState<FileUploadStatus[]>([]);

  // Sync testcases when loader data changes
  React.useEffect(() => {
    setTestcases(initialTestcases);
  }, [initialTestcases]);

  // Fetch STS credentials on mount
  React.useEffect(() => {
    fetchCredentials();
  }, [problemId]);

  const fetchCredentials = async () => {
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const response = await fetch(
        `/api/admin/problems/${problemId}/testdata?intent=getCredentials`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch upload credentials");
      }
      const creds = await response.json();
      setCredentials(creds);
    } catch (error) {
      setCredentialsError(
        error instanceof Error ? error.message : "Failed to get credentials"
      );
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTestcases(new Set(testcases.map((tc) => tc.number)));
    } else {
      setSelectedTestcases(new Set());
    }
  };

  const handleSelectTestcase = (number: number, checked: boolean) => {
    const newSelected = new Set(selectedTestcases);
    if (checked) {
      newSelected.add(number);
    } else {
      newSelected.delete(number);
    }
    setSelectedTestcases(newSelected);
  };

  // Validate file name matches pattern: 1.in, 1.out, 2.in, 2.out, etc.
  const validateFileName = (name: string): boolean => {
    return /^[1-9][0-9]*\.(in|out)$/.test(name);
  };

  // Handle multi-file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!validateFileName(file.name)) {
        errors.push(`Invalid filename: ${file.name} (must be N.in or N.out)`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024 * 1024) {
        errors.push(`File too large: ${file.name} (max 5GB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setUploadError(errors.join("; "));
    } else {
      setUploadError(null);
    }

    setSelectedFiles(validFiles);
    setFileUploadStatuses(
      validFiles.map((f) => ({ filename: f.name, status: "pending" }))
    );
    event.target.value = "";
  };

  // Upload files directly to S3 using AWS SDK
  const handleDirectUpload = async () => {
    if (!credentials || selectedFiles.length === 0) return;

    // Check if credentials are expired
    if (new Date(credentials.expiration) < new Date()) {
      setUploadError("Credentials expired. Refreshing...");
      await fetchCredentials();
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const statuses = [...fileUploadStatuses];
    let successCount = 0;
    let errorCount = 0;

    try {
      // Dynamically import AWS SDK for browser usage
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

      const s3Client = new S3Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        statuses[i] = { ...statuses[i], status: "uploading" };
        setFileUploadStatuses([...statuses]);

        try {
          const key = `${credentials.problemName}/${file.name}`;

          await s3Client.send(
            new PutObjectCommand({
              Bucket: credentials.bucket,
              Key: key,
              Body: file,
              ContentType: "application/octet-stream",
            })
          );

          statuses[i] = { ...statuses[i], status: "success" };
          successCount++;
        } catch (error) {
          statuses[i] = {
            ...statuses[i],
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
          };
          errorCount++;
        }

        setFileUploadStatuses([...statuses]);
      }
    } catch (sdkError) {
      // AWS SDK failed to load - fallback to server-side upload
      console.error("AWS SDK load failed, using server fallback:", sdkError);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (statuses[i].status === "success") continue;

        statuses[i] = { ...statuses[i], status: "uploading" };
        setFileUploadStatuses([...statuses]);

        try {
          const formData = new FormData();
          formData.append("uploadType", "file");
          formData.append("number", file.name.split(".")[0]);
          formData.append("fileType", file.name.endsWith(".in") ? "in" : "out");
          formData.append("file", file);

          const response = await fetch(
            `/api/admin/problems/${problemId}/testdata`,
            { method: "POST", body: formData }
          );

          if (!response.ok) {
            throw new Error("Server upload failed");
          }

          statuses[i] = { ...statuses[i], status: "success" };
          successCount++;
        } catch (fallbackError) {
          statuses[i] = {
            ...statuses[i],
            status: "error",
            error: fallbackError instanceof Error ? fallbackError.message : "Upload failed",
          };
          errorCount++;
        }

        setFileUploadStatuses([...statuses]);
      }
    }

    setIsUploading(false);

    if (errorCount === 0) {
      setUploadSuccess(`Successfully uploaded ${successCount} file(s)`);
      setSelectedFiles([]);
      setFileUploadStatuses([]);
      revalidator.revalidate();
    } else {
      setUploadError(`${errorCount} file(s) failed to upload`);
      if (successCount > 0) {
        revalidator.revalidate();
      }
    }
  };

  // Clear selected files
  const handleClearFiles = () => {
    setSelectedFiles([]);
    setFileUploadStatuses([]);
    setUploadError(null);
  };

  const handleSingleUpload = async (
    number: number,
    inputFile: File,
    outputFile: File
  ) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("uploadType", "single");
    formData.append("number", number.toString());
    formData.append("input", inputFile);
    formData.append("output", outputFile);

    try {
      const response = await fetch(`/api/admin/problems/${problemId}/testdata`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadSuccess(`Successfully uploaded testcase ${number}`);
        revalidator.revalidate();
      } else {
        setUploadError(result.error || "Failed to upload testcase");
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTestcases.size === 0) return;

    setIsDeleting(true);
    setUploadError(null);

    try {
      const response = await fetch(`/api/admin/problems/${problemId}/testdata`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testcases: Array.from(selectedTestcases),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadSuccess(`Deleted ${result.deleted} testcases`);
        setSelectedTestcases(new Set());
        revalidator.revalidate();
      } else {
        setUploadError(`Failed to delete some testcases (${result.failed} failed)`);
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Delete failed"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (testcaseNumber: number, type: "in" | "out") => {
    try {
      const response = await fetch(
        `/api/admin/problems/${problemId}/testdata?intent=download&testcase=${testcaseNumber}&type=${type}`
      );

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const { url, content } = await response.json();

      if (content !== undefined) {
        // Direct content download (small files)
        const blob = new Blob([content], { type: "text/plain" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${testcaseNumber}.${type}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else if (url) {
        // Presigned URL download (large files)
        window.open(url, "_blank");
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Download failed"
      );
    }
  };

  const validTestcases = testcases.filter((tc) => tc.hasInput && tc.hasOutput);
  const incompleteTestcases = testcases.filter(
    (tc) => !tc.hasInput || !tc.hasOutput
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/admin/editproblem/${problemId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Testdata: {problemId}
              </h1>
              <Badge variant={problem.validated ? "success" : "secondary"}>
                {validTestcases.length} / {problem.testcaseCount} testcases
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Manage test cases for this problem
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state === "loading"}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                revalidator.state === "loading" && "animate-spin"
              )}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {uploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <XCircle className="h-5 w-5" />
            <p className="font-medium">{uploadError}</p>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">{uploadSuccess}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Testcases</CardTitle>
            {credentialsError && (
              <Button variant="outline" size="sm" onClick={fetchCredentials}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credentials Status */}
          {credentialsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading upload credentials...
            </div>
          )}
          {credentialsError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Failed to load upload credentials. Using server-side upload as fallback.
            </div>
          )}

          {/* Multi-file Upload */}
          <div className="space-y-3">
            <Label>Upload Multiple Files</Label>
            <div className="flex items-center gap-4">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-6 py-4 transition-colors flex-1",
                  isUploading
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                    : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                )}
              >
                <Files className="h-6 w-6 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">
                    {isUploading ? "Uploading..." : "Click to select files"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Select .in and .out files (e.g., 1.in, 1.out, 2.in, 2.out)
                  </p>
                </div>
                <input
                  type="file"
                  accept=".in,.out"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selectedFiles.length} file(s) selected
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFiles}
                    disabled={isUploading}
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-gray-50 p-2">
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {fileUploadStatuses.map((status, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1",
                          status.status === "success" && "bg-emerald-100 text-emerald-800",
                          status.status === "error" && "bg-red-100 text-red-800",
                          status.status === "uploading" && "bg-blue-100 text-blue-800",
                          status.status === "pending" && "bg-gray-100"
                        )}
                      >
                        {status.status === "uploading" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {status.status === "success" && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {status.status === "error" && (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span className="font-mono text-xs">{status.filename}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleDirectUpload}
                  disabled={isUploading || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {selectedFiles.length} file(s)
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Files must be named as N.in or N.out where N is a positive integer
              (e.g., 1.in, 1.out, 2.in, 2.out). Max file size: 5GB.
            </p>
          </div>

          <Separator />

          {/* Single Testcase Upload */}
          <SingleTestcaseUpload
            onUpload={handleSingleUpload}
            isUploading={isUploading}
            nextNumber={validTestcases.length + 1}
          />
        </CardContent>
      </Card>

      {/* Testcases Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Testcases ({testcases.length})</CardTitle>
            {selectedTestcases.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedTestcases.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {testcases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium">No testcases yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a ZIP file or individual testcases to get started.
              </p>
            </div>
          ) : (
            <Table className="w-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedTestcases.size === testcases.length &&
                        testcases.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="w-32">Input</TableHead>
                  <TableHead className="w-32">Output</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testcases.map((tc) => (
                  <TableRow key={tc.number}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTestcases.has(tc.number)}
                        onCheckedChange={(checked) =>
                          handleSelectTestcase(tc.number, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {tc.number}
                    </TableCell>
                    <TableCell>
                      {tc.hasInput ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {tc.number}.in
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tc.hasOutput ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {tc.number}.out
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tc.hasInput && tc.hasOutput ? (
                        <Badge variant="success">Complete</Badge>
                      ) : (
                        <Badge variant="destructive">Incomplete</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tc.hasInput && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(tc.number, "in")}
                            title={`Download ${tc.number}.in`}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            .in
                          </Button>
                        )}
                        {tc.hasOutput && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(tc.number, "out")}
                            title={`Download ${tc.number}.out`}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            .out
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {incompleteTestcases.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  {incompleteTestcases.length} incomplete testcase(s)
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Testcases {incompleteTestcases.map((tc) => tc.number).join(", ")}{" "}
                  are missing input or output files.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Single testcase upload component
function SingleTestcaseUpload({
  onUpload,
  isUploading,
  nextNumber,
}: {
  onUpload: (number: number, input: File, output: File) => void;
  isUploading: boolean;
  nextNumber: number;
}) {
  const [number, setNumber] = React.useState(nextNumber);
  const [inputFile, setInputFile] = React.useState<File | null>(null);
  const [outputFile, setOutputFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    setNumber(nextNumber);
  }, [nextNumber]);

  const handleUpload = () => {
    if (inputFile && outputFile) {
      onUpload(number, inputFile, outputFile);
      setInputFile(null);
      setOutputFile(null);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Upload Single Testcase</Label>
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Testcase #</Label>
          <Input
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumber(parseInt(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Input (.in)</Label>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-2 text-sm hover:border-gray-400">
            {inputFile ? inputFile.name : "Choose file"}
            <input
              type="file"
              accept=".in,.txt"
              onChange={(e) => setInputFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Output (.out)</Label>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-2 text-sm hover:border-gray-400">
            {outputFile ? outputFile.name : "Choose file"}
            <input
              type="file"
              accept=".out,.ans,.txt"
              onChange={(e) => setOutputFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleUpload}
            disabled={!inputFile || !outputFile || isUploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
