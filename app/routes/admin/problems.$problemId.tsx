import * as React from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/problems.$problemId";
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
  Clock,
  HardDrive,
  Layers,
  ShieldCheck,
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
import { FileDropzone } from "~/components/ui/file-dropzone";
import type { Problem, ProblemType } from "~/types/problem";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

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

// Sample problem data for demonstration
const getSampleProblem = (problemId: string): Problem => ({
  problemName: problemId,
  title: problemId === "two_sum" ? "Two Sum" : "New Problem",
  problem_type: "Batch",
  validated: problemId === "two_sum",
  timeLimit: 1,
  memoryLimit: 256,
  testcaseCount: 10,
  fullFeedback: true,
  customChecker: false,
  attachments: false,
  subtaskScores: [30, 70],
  subtaskDependency: ["1-5", "1-10"],
  verdicts: {
    testdata: true,
    statement: true,
    scoring: true,
    attachments: true,
    checker: true,
    grader: true,
    subtasks: true,
  },
  remarks: {
    testdata: "10 test cases found",
    statement: "PDF statement uploaded",
    scoring: "Total score: 100",
    attachments: "No attachments required",
    checker: "Default checker",
    grader: "Not required for Batch",
    subtasks: "2 subtasks configured",
  },
});

const problemOptions = [
  { value: "fullFeedback", label: "Full Feedback" },
  { value: "customChecker", label: "Custom Checker" },
  { value: "attachments", label: "Attachments" },
];

export default function EditProblemPage() {
  const params = useParams();
  const problemId = params.problemId as string;

  // In a real app, this would fetch from API
  const [problem, setProblem] = React.useState<Problem>(() => getSampleProblem(problemId));
  const [subtasks, setSubtasks] = React.useState<Subtask[]>(() =>
    problem.subtaskScores.map((score, i) => ({
      id: crypto.randomUUID(),
      score,
      dependency: problem.subtaskDependency[i],
    }))
  );

  // DnD sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // File upload state
  const [statementFiles, setStatementFiles] = React.useState<UploadedFile[]>([]);
  const [checkerFiles, setCheckerFiles] = React.useState<UploadedFile[]>([]);
  const [graderFiles, setGraderFiles] = React.useState<UploadedFile[]>([]);
  const [headerFiles, setHeaderFiles] = React.useState<UploadedFile[]>([]);
  const [headerAFiles, setHeaderAFiles] = React.useState<UploadedFile[]>([]);
  const [headerBFiles, setHeaderBFiles] = React.useState<UploadedFile[]>([]);
  const [attachmentFiles, setAttachmentFiles] = React.useState<UploadedFile[]>([]);

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
            <Link to={`/problem/${problemId}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Problem
            </Link>
          </Button>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

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
            {/* Statement Upload */}
            <FileDropzone
              label="Problem Statement"
              accept=".html,.pdf"
              description="HTML or PDF format"
              files={statementFiles}
              onFilesChange={setStatementFiles}
              multiple
            />

            {/* Checker Upload - only if custom checker enabled */}
            {problem.customChecker && (
              <FileDropzone
                label="Custom Checker"
                accept=".cpp"
                description="C++ source file"
                files={checkerFiles}
                onFilesChange={setCheckerFiles}
              />
            )}

            {/* Grader Upload - for Interactive/Communication */}
            {(problem.problem_type === "Interactive" ||
              problem.problem_type === "Communication") && (
              <>
                <FileDropzone
                  label="Grader"
                  accept=".cpp"
                  description="C++ source file"
                  files={graderFiles}
                  onFilesChange={setGraderFiles}
                />

                {problem.problem_type === "Interactive" && (
                  <FileDropzone
                    label="Header File"
                    accept=".h"
                    description="C/C++ header file"
                    files={headerFiles}
                    onFilesChange={setHeaderFiles}
                  />
                )}

                {problem.problem_type === "Communication" && (
                  <>
                    <FileDropzone
                      label={`${problem.nameA || "FileA"} Header`}
                      accept=".h"
                      description="C/C++ header file"
                      files={headerAFiles}
                      onFilesChange={setHeaderAFiles}
                    />
                    <FileDropzone
                      label={`${problem.nameB || "FileB"} Header`}
                      accept=".h"
                      description="C/C++ header file"
                      files={headerBFiles}
                      onFilesChange={setHeaderBFiles}
                    />
                  </>
                )}
              </>
            )}

            {/* Attachments Upload - only if enabled */}
            {problem.attachments && (
              <FileDropzone
                label="Attachments"
                accept=".zip"
                description="ZIP archive"
                files={attachmentFiles}
                onFilesChange={setAttachmentFiles}
              />
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
                <Link to={`/admin/uploadtestdata/${problemId}`} target="_blank">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Testdata
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

            <Button variant="secondary">
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
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                All Submissions
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Non-zero
              </Button>
              <Button variant="outline" size="sm">
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

            <Button>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Validate Problem
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
