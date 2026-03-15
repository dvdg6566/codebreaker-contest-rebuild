import * as React from "react";
import { Link } from "react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";

import { DataTable } from "~/components/ui/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table-column-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import type { ProblemListItem } from "~/types/problem";

export const problemColumns: ColumnDef<ProblemListItem>[] = [
  {
    accessorKey: "problemName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Problem ID" />
    ),
    cell: ({ row }) => {
      const problemName = row.getValue("problemName") as string;
      return (
        <Link
          to={`/admin/problems/${problemName}`}
          className="font-medium text-primary hover:underline"
        >
          {problemName}
        </Link>
      );
    },
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => {
      return <span className="text-muted-foreground">{row.getValue("title") || "-"}</span>;
    },
  },
  {
    accessorKey: "yourScore",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Your Score" />
    ),
    cell: ({ row }) => {
      const score = row.getValue("yourScore") as number;
      return (
        <div className="flex items-center">
          {score === 100 ? (
            <Badge variant="success">{score}</Badge>
          ) : score > 0 ? (
            <Badge variant="warning">{score}</Badge>
          ) : (
            <span className="text-muted-foreground">{score}</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "validated",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Validated" />
    ),
    cell: ({ row }) => {
      const validated = row.getValue("validated") as boolean;
      return (
        <Badge variant={validated ? "success" : "destructive"}>
          {validated ? "Ok" : "No"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "problem_type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Problem Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("problem_type") as string;
      return <span>{type}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const problem = row.original;

      return (
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/admin/problems/${problem.problemName}`}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit problem</span>
          </Link>
        </Button>
      );
    },
  },
];

interface ProblemManagementTableProps {
  data: ProblemListItem[];
  onAddProblem?: (problemId: string) => void;
}

export function ProblemManagementTable({
  data,
  onAddProblem,
}: ProblemManagementTableProps) {
  const [newProblemId, setNewProblemId] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const existingIds = new Set(data.map((p) => p.problemName));

  const handleAddProblem = () => {
    if (!newProblemId.trim()) return;
    if (existingIds.has(newProblemId)) {
      alert("Problem ID already exists");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newProblemId)) {
      alert("Problem ID can only contain letters, numbers, and underscores");
      return;
    }
    onAddProblem?.(newProblemId);
    setNewProblemId("");
    setDialogOpen(false);
  };

  return (
    <DataTable
      columns={problemColumns}
      data={data}
      searchKey="problemName"
      searchPlaceholder="Search problems..."
      toolbar={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Problem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Problem</DialogTitle>
              <DialogDescription>
                Enter a unique problem ID. Only letters, numbers, and underscores
                are allowed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="problemId" className="text-right">
                  Problem ID
                </Label>
                <Input
                  id="problemId"
                  value={newProblemId}
                  onChange={(e) => setNewProblemId(e.target.value)}
                  placeholder="e.g., two_sum"
                  className="col-span-3"
                  pattern="[a-zA-Z0-9_]+"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProblem}>Create Problem</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />
  );
}

