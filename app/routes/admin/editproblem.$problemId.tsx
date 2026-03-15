import * as React from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/editproblem.$problemId";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileCode,
  FileText,
  Clock,
  HardDrive,
  Layers,
  ShieldCheck,
  Download,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { MultiSelect } from "~/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { SortableSubtaskItem } from "~/components/admin/sortable-subtask-item";
import type { Problem, ProblemType } from "~/types/problem";


interface Subtask {
  id: string;
  score: number;
  dependency: string;
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Edit Problem: ${params.problemId} - Codebreaker Admin` },
    { name: "description", content: `Edit problem ${params.problemId}` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { getProblem, validateProblemFiles } = await import("~/lib/db/problems.server");
  const {
    checkStatementExists,
    checkerSourceExists,
    checkerIsCompiled,
    listGraderFiles,
    attachmentExists,
  } = await import("~/lib/s3.server");

  await requireAdmin(request);

  const problemName = params.problemId;
  const problem = await getProblem(problemName);

  if (!problem) {
    throw new Response("Problem not found", { status: 404 });
  }

  // Get validation status (cached from DynamoDB, doesn't re-validate)
  const validation = await validateProblemFiles(problemName);

  // Fetch existing file info in parallel
  const [statementExists, hasCheckerSource, hasCompiledChecker, graderFiles, hasAttachment] = await Promise.all([
    checkStatementExists(problemName),
    checkerSourceExists(problemName),
    checkerIsCompiled(problemName),
    listGraderFiles(problemName),
    attachmentExists(problemName),
  ]);

  // Build existing files info (URLs generated on-demand when download is clicked)
  const existingFiles: {
    statements: { name: string; format: "html" | "pdf" }[];
    checker: { source: boolean; compiled: boolean };
    graders: string[];
    attachment: { exists: boolean };
  } = {
    statements: [],
    checker: { source: hasCheckerSource, compiled: hasCompiledChecker },
    graders: graderFiles,
    attachment: { exists: hasAttachment },
  };

  // Record which statement formats exist
  if (statementExists.html) {
    existingFiles.statements.push({ name: `${problemName}.html`, format: "html" });
  }
  if (statementExists.pdf) {
    existingFiles.statements.push({ name: `${problemName}.pdf`, format: "pdf" });
  }

  return {
    problem: {
      ...problem,
      validated: validation?.validated ?? problem.validated,
      verdicts: validation?.verdicts || problem.verdicts,
      remarks: validation?.remarks || problem.remarks,
    },
    existingFiles,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { getProblem, updateProblem, updateSubtasks, validateAndUpdateProblem } = await import("~/lib/db/problems.server");
  const { regradeProblem, compileChecker } = await import("~/lib/grading.server");

  await requireAdmin(request);

  const problemName = params.problemId;
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "save": {
      const title = formData.get("title") as string;
      const problemType = formData.get("problem_type") as ProblemType;
      const timeLimit = parseFloat(formData.get("timeLimit") as string) || 1;
      const memoryLimit = parseInt(formData.get("memoryLimit") as string) || 256;
      const fullFeedback = formData.get("fullFeedback") === "true";
      const customChecker = formData.get("customChecker") === "true";
      const attachments = formData.get("attachments") === "true";
      const nameA = formData.get("nameA") as string || undefined;
      const nameB = formData.get("nameB") as string || undefined;

      await updateProblem(problemName, {
        title,
        problem_type: problemType,
        timeLimit,
        memoryLimit,
        fullFeedback,
        customChecker,
        attachments,
        nameA,
        nameB,
      });

      return { success: true, message: "Problem saved successfully" };
    }

    case "updateSubtasks": {
      const subtaskData = formData.get("subtasks") as string;
      const subtasks = JSON.parse(subtaskData) as { score: number; dependency: string }[];

      const subtaskScores = subtasks.map((st) => st.score);
      const subtaskDependency = subtasks.map((st) => st.dependency);

      // Also update testcaseCount based on the max testcase referenced in dependencies
      let maxTestcase = 0;
      for (const dep of subtaskDependency) {
        const parts = dep.split(",");
        for (const part of parts) {
          if (part.includes("-")) {
            const [, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
            maxTestcase = Math.max(maxTestcase, end);
          } else {
            const num = parseInt(part.trim(), 10);
            if (!isNaN(num)) maxTestcase = Math.max(maxTestcase, num);
          }
        }
      }

      await updateSubtasks(problemName, subtaskScores, subtaskDependency);
      if (maxTestcase > 0) {
        await updateProblem(problemName, { testcaseCount: maxTestcase });
      }

      return { success: true, message: "Subtasks updated successfully" };
    }

    case "validate": {
      const validation = await validateAndUpdateProblem(problemName);
      return {
        success: validation.validated,
        message: validation.validated ? "Problem validated successfully" : "Validation failed - check the issues above",
        validation,
      };
    }

    case "regrade": {
      const regradeType = formData.get("regradeType") as "NORMAL" | "AC" | "NONZERO";
      const result = await regradeProblem(problemName, regradeType);
      return { success: true, message: `Regrading ${result.count} submissions` };
    }

    case "compileChecker": {
      const result = await compileChecker(problemName);
      return {
        success: result.success,
        message: result.success ? "Checker compiled successfully" : result.error,
      };
    }

    default:
      return { success: false, message: "Unknown action" };
  }
}

const problemOptions = [
  { value: "fullFeedback", label: "Full Feedback" },
  { value: "customChecker", label: "Custom Checker" },
  { value: "attachments", label: "Attachments" },
];

export default function EditProblemPage({ loaderData, actionData }: Route.ComponentProps) {
  const { problem: initialProblem, existingFiles } = loaderData;
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  // Local state for editing
  const [problem, setProblem] = React.useState<Problem>(() => initialProblem);
  const [subtasks, setSubtasks] = React.useState<Subtask[]>(() =>
    initialProblem.subtaskScores.map((score, i) => ({
      id: crypto.randomUUID(),
      score,
      dependency: initialProblem.subtaskDependency?.[i] || "1",
    }))
  );

  // Update local state when loader data changes
  React.useEffect(() => {
    setProblem(initialProblem);
    setSubtasks(
      initialProblem.subtaskScores.map((score, i) => ({
        id: crypto.randomUUID(),
        score,
        dependency: initialProblem.subtaskDependency?.[i] || "1",
      }))
    );
  }, [initialProblem]);

  // Revalidate loader data after fetcher completes (e.g., after validation)
  React.useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data]);

  const isLoading = fetcher.state !== "idle";

  // DnD sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Upload status state
  const [uploadStatus, setUploadStatus] = React.useState<{
    type: string;
    success: boolean;
    message: string;
    compileError?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  // Hidden file input refs for inline replace/upload buttons
  const replaceStatementRef = React.useRef<HTMLInputElement>(null);
  const replaceCheckerRef = React.useRef<HTMLInputElement>(null);
  const replaceGraderCppRef = React.useRef<HTMLInputElement>(null);
  const replaceHeaderRef = React.useRef<HTMLInputElement>(null);
  const replaceHeaderARef = React.useRef<HTMLInputElement>(null);
  const replaceHeaderBRef = React.useRef<HTMLInputElement>(null);
  const replaceAttachmentRef = React.useRef<HTMLInputElement>(null);

  // Auto-upload when a file is picked via a replace button
  const handleReplaceFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "statement" | "checker" | "grader" | "header" | "attachment",
    extraParams?: { filename?: string }
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected
    await handleUploadFile(type, [file], type, extraParams);
  };

  // Download file handler - fetches presigned URL on demand
  const handleDownload = async (type: string, name?: string) => {
    try {
      const params = new URLSearchParams({ type });
      if (name) params.append("name", name);

      const response = await fetch(
        `/api/admin/problems/${problem.problemName}/download?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const { url } = await response.json();
      window.open(url, "_blank");
    } catch (error) {
      console.error("Download failed:", error);
    }
  };


  // Upload file handler
  const handleUploadFile = async (
    type: "statement" | "checker" | "grader" | "header" | "attachment",
    rawFiles: File[],
    stateType: string,
    extraParams?: { filename?: string }
  ) => {
    if (rawFiles.length === 0) {
      setUploadStatus({
        type: stateType,
        success: false,
        message: "No file selected",
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const file = rawFiles[0];
    const formData = new FormData();
    formData.append("problemName", problem.problemName);
    formData.append("type", type);
    formData.append("file", file);
    if (extraParams?.filename) {
      formData.append("filename", extraParams.filename);
    }

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setUploadStatus({
          type: stateType,
          success: false,
          message: result.error || "Upload failed",
        });
        return;
      }

      if (type === "checker") {
        setUploadStatus({
          type: stateType,
          success: result.compiled,
          message: result.compiled
            ? "Checker uploaded and compiled successfully"
            : "Checker uploaded but compilation failed",
          compileError: result.compileError,
        });
      } else {
        setUploadStatus({
          type: stateType,
          success: result.success,
          message: result.success
            ? `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`
            : result.error,
        });
      }

      // Clear file selection and refresh data
      revalidator.revalidate();
    } catch (error) {
      setUploadStatus({
        type: stateType,
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Compute selected options from problem state
  const selectedOptions = React.useMemo(() => {
    const selected: string[] = [];
    if (problem.fullFeedback) selected.push("fullFeedback");
    if (problem.customChecker) selected.push("customChecker");
    if (problem.attachments) selected.push("attachments");
    return selected;
  }, [problem.fullFeedback, problem.customChecker, problem.attachments]);

  const handleOptionsChange = (selected: string[]) => {
    setProblem((prev) => ({
      ...prev,
      fullFeedback: selected.includes("fullFeedback"),
      customChecker: selected.includes("customChecker"),
      attachments: selected.includes("attachments"),
    }));
  };

  const handleProblemTypeChange = (value: ProblemType) => {
    setProblem((prev) => ({ ...prev, problem_type: value }));
  };

  const handleAddSubtask = () => {
    setSubtasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), score: 0, dependency: "1" },
    ]);
  };

  const handleDeleteSubtask = (id: string) => {
    if (subtasks.length > 1) {
      setSubtasks((prev) => prev.filter((st) => st.id !== id));
    }
  };

  const handleSubtaskChange = (id: string, field: "score" | "dependency", value: string) => {
    setSubtasks((prev) =>
      prev.map((st) =>
        st.id === id
          ? { ...st, [field]: field === "score" ? parseInt(value) || 0 : value }
          : st
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSubtasks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const totalScore = subtasks.reduce((sum, st) => sum + st.score, 0);

  // Form submission handlers
  const handleSave = () => {
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("title", problem.title);
    formData.append("problem_type", problem.problem_type);
    formData.append("timeLimit", problem.timeLimit.toString());
    formData.append("memoryLimit", problem.memoryLimit.toString());
    formData.append("fullFeedback", problem.fullFeedback ? "true" : "false");
    formData.append("customChecker", problem.customChecker ? "true" : "false");
    formData.append("attachments", problem.attachments ? "true" : "false");
    if (problem.nameA) formData.append("nameA", problem.nameA);
    if (problem.nameB) formData.append("nameB", problem.nameB);
    fetcher.submit(formData, { method: "post" });
  };

  const handleUpdateSubtasks = () => {
    const formData = new FormData();
    formData.append("intent", "updateSubtasks");
    formData.append("subtasks", JSON.stringify(subtasks.map((st) => ({ score: st.score, dependency: st.dependency }))));
    fetcher.submit(formData, { method: "post" });
  };

  const handleValidate = () => {
    const formData = new FormData();
    formData.append("intent", "validate");
    fetcher.submit(formData, { method: "post" });
  };

  const handleRegrade = (regradeType: "NORMAL" | "AC" | "NONZERO") => {
    const formData = new FormData();
    formData.append("intent", "regrade");
    formData.append("regradeType", regradeType);
    fetcher.submit(formData, { method: "post" });
  };

  const handleCompileChecker = () => {
    const formData = new FormData();
    formData.append("intent", "compileChecker");
    fetcher.submit(formData, { method: "post" });
  };

  // Stats for the stats row
  const stats = [
    {
      title: "Problem Type",
      value: problem.problem_type,
      icon: FileCode,
      color: "bg-violet-100 text-violet-600",
    },
    {
      title: "Time Limit",
      value: `${problem.timeLimit}s`,
      icon: Clock,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Memory Limit",
      value: `${problem.memoryLimit}MB`,
      icon: HardDrive,
      color: "bg-amber-100 text-amber-600",
    },
    {
      title: "Subtasks",
      value: subtasks.length.toString(),
      icon: Layers,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Status",
      value: problem.validated ? "Valid" : "Invalid",
      icon: ShieldCheck,
      color: problem.validated ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/problems">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {problem.problemName}
              </h1>
              <Badge variant={problem.validated ? "success" : "destructive"}>
                {problem.validated ? "Validated" : "Not Validated"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Editing problem configuration and files
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/admin/problem/${problem.problemName}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Test Problem
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status message */}
      {fetcher.data?.message && (
        <div className={`p-3 rounded-lg text-sm ${fetcher.data.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {fetcher.data.message}
        </div>
      )}

      {/* Upload status message */}
      {uploadStatus && (
        <div className={`p-3 rounded-lg text-sm ${uploadStatus.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          <div className="flex items-center gap-2">
            {uploadStatus.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {uploadStatus.message}
          </div>
          {uploadStatus.compileError && (
            <div className="mt-2">
              <p className="font-medium mb-1">Compiler Output:</p>
              <pre className="bg-red-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {uploadStatus.compileError}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-lg font-semibold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Problem Info Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Problem Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Problem Title</Label>
              <Input
                id="title"
                value={problem.title}
                onChange={(e) =>
                  setProblem((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter problem title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Problem Type</Label>
              <Select
                value={problem.problem_type}
                onValueChange={handleProblemTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Batch">Batch</SelectItem>
                  <SelectItem value="Interactive">Interactive</SelectItem>
                  <SelectItem value="Communication">Communication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={problem.timeLimit}
                onChange={(e) =>
                  setProblem((prev) => ({
                    ...prev,
                    timeLimit: parseFloat(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
              <Input
                id="memoryLimit"
                type="number"
                value={problem.memoryLimit}
                onChange={(e) =>
                  setProblem((prev) => ({
                    ...prev,
                    memoryLimit: parseInt(e.target.value) || 256,
                  }))
                }
              />
            </div>
          </div>

          {/* Communication problem file names */}
          {problem.problem_type === "Communication" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nameA">First File Name</Label>
                <Input
                  id="nameA"
                  value={problem.nameA || ""}
                  onChange={(e) =>
                    setProblem((prev) => ({ ...prev, nameA: e.target.value }))
                  }
                  placeholder="e.g., alice"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameB">Second File Name</Label>
                <Input
                  id="nameB"
                  value={problem.nameB || ""}
                  onChange={(e) =>
                    setProblem((prev) => ({ ...prev, nameB: e.target.value }))
                  }
                  placeholder="e.g., bob"
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Options - MultiSelect */}
          <div className="space-y-2">
            <Label>Problem Options</Label>
            <MultiSelect
              options={problemOptions}
              selected={selectedOptions}
              onSelectionChange={handleOptionsChange}
              placeholder="Select problem options..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Section: Statements & Files / Testcases & Subtasks */}
      <div className="grid grid-cols-2 gap-6">
        {/* Statements and Files Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Statements and Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Existing Statements */}
            {existingFiles.statements.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Statements</Label>
                <div className="flex flex-wrap gap-2">
                  {existingFiles.statements.map((file) => (
                    <div key={file.name} className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDownload("statement", file.name)}
                        className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        {file.name}
                        <Download className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <input
                        ref={replaceStatementRef}
                        type="file"
                        accept=".html,.pdf"
                        className="hidden"
                        onChange={(e) => handleReplaceFile(e, "statement")}
                      />
                      <button
                        type="button"
                        onClick={() => replaceStatementRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="h-3 w-3" />
                        Replace
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statement — upload button when none exist */}
            {existingFiles.statements.length === 0 && (
              <div className="space-y-2">
                <Label>Statement</Label>
                <div>
                  <input ref={replaceStatementRef} type="file" accept=".html,.pdf" className="hidden" onChange={(e) => handleReplaceFile(e, "statement")} />
                  <Button variant="outline" size="sm" onClick={() => replaceStatementRef.current?.click()} disabled={isUploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Statement
                  </Button>
                </div>
              </div>
            )}

            {/* Checker */}
            {problem.customChecker && (
              <div className="space-y-2">
                <Label>Checker</Label>
                <div>
                <input ref={replaceCheckerRef} type="file" accept=".cpp" className="hidden" onChange={(e) => handleReplaceFile(e, "checker")} />
                {existingFiles.checker.source ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleDownload("checker")} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                      <FileText className="h-4 w-4" />
                      {problem.problemName}.cpp
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => replaceCheckerRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                      <Upload className="h-3 w-3" />
                      Replace & Compile
                    </button>
                    <Badge variant={existingFiles.checker.compiled ? "success" : "secondary"}>
                      {existingFiles.checker.compiled ? "Compiled" : "Not Compiled"}
                    </Badge>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => replaceCheckerRef.current?.click()} disabled={isUploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Compile Checker
                  </Button>
                )}
                </div>
              </div>
            )}

            {/* Grader files */}
            {(problem.problem_type === "Interactive" || problem.problem_type === "Communication") && (
              <div>
                <input ref={replaceGraderCppRef} type="file" accept=".cpp" className="hidden" onChange={(e) => handleReplaceFile(e, "grader")} />
                <input ref={replaceHeaderRef} type="file" accept=".h" className="hidden" onChange={(e) => handleReplaceFile(e, "header", { filename: `${problem.problemName}.h` })} />
                <input ref={replaceHeaderARef} type="file" accept=".h" className="hidden" onChange={(e) => handleReplaceFile(e, "header", { filename: `${problem.nameA || "fileA"}.h` })} />
                <input ref={replaceHeaderBRef} type="file" accept=".h" className="hidden" onChange={(e) => handleReplaceFile(e, "header", { filename: `${problem.nameB || "fileB"}.h` })} />
                <div className="flex flex-col gap-2 items-start">
                <Label>Grader Files</Label>
                  {/* grader.cpp */}
                  {existingFiles.graders.includes("grader.cpp") ? (
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => handleDownload("grader", "grader.cpp")} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                        <FileText className="h-4 w-4" />grader.cpp<Download className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => replaceGraderCppRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                        <Upload className="h-3 w-3" />Replace
                      </button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-auto" onClick={() => replaceGraderCppRef.current?.click()} disabled={isUploading}>
                      <Upload className="mr-2 h-4 w-4" />Upload grader.cpp
                    </Button>
                  )}
                  {/* Interactive header */}
                  {problem.problem_type === "Interactive" && (() => {
                    const headerName = `${problem.problemName}.h`;
                    return existingFiles.graders.includes(headerName) ? (
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => handleDownload("grader", headerName)} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                          <FileText className="h-4 w-4" />{headerName}<Download className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button type="button" onClick={() => replaceHeaderRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                          <Upload className="h-3 w-3" />Replace
                        </button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-auto" onClick={() => replaceHeaderRef.current?.click()} disabled={isUploading}>
                        <Upload className="mr-2 h-4 w-4" />Upload {headerName}
                      </Button>
                    );
                  })()}
                  {/* Communication headers */}
                  {problem.problem_type === "Communication" && (() => {
                    const headerA = `${problem.nameA || "fileA"}.h`;
                    const headerB = `${problem.nameB || "fileB"}.h`;
                    return (
                      <>
                        {existingFiles.graders.includes(headerA) ? (
                          <div className="inline-flex items-center gap-1">
                            <button type="button" onClick={() => handleDownload("grader", headerA)} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                              <FileText className="h-4 w-4" />{headerA}<Download className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button type="button" onClick={() => replaceHeaderARef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                              <Upload className="h-3 w-3" />Replace
                            </button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-auto" onClick={() => replaceHeaderARef.current?.click()} disabled={isUploading}>
                            <Upload className="mr-2 h-4 w-4" />Upload {headerA}
                          </Button>
                        )}
                        {existingFiles.graders.includes(headerB) ? (
                          <div className="inline-flex items-center gap-1">
                            <button type="button" onClick={() => handleDownload("grader", headerB)} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                              <FileText className="h-4 w-4" />{headerB}<Download className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button type="button" onClick={() => replaceHeaderBRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                              <Upload className="h-3 w-3" />Replace
                            </button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-auto" onClick={() => replaceHeaderBRef.current?.click()} disabled={isUploading}>
                            <Upload className="mr-2 h-4 w-4" />Upload {headerB}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Attachment */}
            {problem.attachments && (
              <div className="space-y-2">
                <Label>Attachment</Label>
                <input ref={replaceAttachmentRef} type="file" accept=".zip" className="hidden" onChange={(e) => handleReplaceFile(e, "attachment")} />
                {existingFiles.attachment.exists ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleDownload("attachment")} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                      <FileText className="h-4 w-4" />
                      {problem.problemName}.zip
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => replaceAttachmentRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50">
                      <Upload className="h-3 w-3" />
                      Replace
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => replaceAttachmentRef.current?.click()} disabled={isUploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Attachment
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Testcases and Subtasks Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Testcases and Subtasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link to={`/admin/editproblem/${problem.problemName}/testdata`} target="_blank">
                  <Upload className="mr-2 h-4 w-4" />
                  Manage Testdata
                </Link>
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Subtasks</Label>
              <Button variant="outline" size="sm" onClick={handleAddSubtask}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subtask
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={subtasks.map((st) => st.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {subtasks.map((subtask, index) => (
                    <SortableSubtaskItem
                      key={subtask.id}
                      id={subtask.id}
                      index={index}
                      score={subtask.score}
                      dependency={subtask.dependency}
                      onScoreChange={(value) =>
                        handleSubtaskChange(subtask.id, "score", value)
                      }
                      onDependencyChange={(value) =>
                        handleSubtaskChange(subtask.id, "dependency", value)
                      }
                      onDelete={() => handleDeleteSubtask(subtask.id)}
                      canDelete={subtasks.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total Score:</span>
              <Badge variant={totalScore === 100 ? "success" : totalScore > 100 ? "destructive" : "warning"}>
                {totalScore} / 100
              </Badge>
              {totalScore !== 100 && (
                <span className="text-sm text-muted-foreground">
                  {totalScore > 100 ? "(exceeds 100)" : "(should equal 100)"}
                </span>
              )}
            </div>

            <Button variant="secondary" onClick={handleUpdateSubtasks} disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              Update Subtasks
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Section: Regrade / Validation */}
      <div className="grid grid-cols-2 gap-6">
        {/* Regrade Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Regrade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleRegrade("NORMAL")} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                All Submissions
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRegrade("NONZERO")} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Non-zero
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRegrade("AC")} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                ACs Only
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Validation Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Validation Status</CardTitle>
              <Badge
                variant={problem.validated ? "success" : "destructive"}
                className="text-sm"
              >
                {problem.validated ? "Validated" : "Not Validated"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problem.verdicts &&
                  Object.entries(problem.verdicts).map(([category, status]) => (
                    <TableRow key={category}>
                      <TableCell className="font-medium capitalize">
                        {category}
                      </TableCell>
                      <TableCell>
                        {status ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {problem.remarks?.[category as keyof typeof problem.remarks]}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <Button onClick={handleValidate} disabled={isLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Validate Problem
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
