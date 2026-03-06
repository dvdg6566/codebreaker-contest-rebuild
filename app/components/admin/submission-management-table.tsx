import { Link } from "react-router";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "~/components/ui/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table-column-header";
import { Badge } from "~/components/ui/badge";
import { ScoreBadge } from "~/components/ui/score-badge";
import type { VerdictType } from "~/components/ui/score-badge";

export interface SubmissionRow {
  subId: number;
  username: string;
  problemName: string;
  problemTitle: string;
  language: string;
  languageDisplay: string;
  verdict: string;
  score: number;
  maxScore: number;
  time: string;
  submissionTime: string;
}

const submissionColumns: ColumnDef<SubmissionRow>[] = [
  {
    accessorKey: "subId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="#" />
    ),
    cell: ({ row }) => {
      const subId = row.getValue("subId") as number;
      return (
        <Link
          to={`/submissions/${subId}`}
          className="font-mono text-primary hover:underline"
        >
          {subId}
        </Link>
      );
    },
  },
  {
    accessorKey: "username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
    cell: ({ row }) => {
      const username = row.getValue("username") as string;
      return (
        <Link
          to={`/profile/${username}`}
          className="font-medium hover:underline"
        >
          {username}
        </Link>
      );
    },
  },
  {
    accessorKey: "problemName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Problem" />
    ),
    cell: ({ row }) => {
      const problemName = row.getValue("problemName") as string;
      const problemTitle = row.original.problemTitle;
      return (
        <Link
          to={`/problems/${problemName}`}
          className="hover:underline text-sm"
        >
          {problemTitle !== problemName ? problemTitle : problemName}
        </Link>
      );
    },
  },
  {
    accessorKey: "languageDisplay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Language" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        {row.getValue("languageDisplay")}
      </Badge>
    ),
  },
  {
    accessorKey: "verdict",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Verdict" />
    ),
    cell: ({ row }) => {
      const verdict = row.getValue("verdict") as string;
      return <ScoreBadge verdict={verdict as VerdictType} />;
    },
  },
  {
    accessorKey: "score",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" />
    ),
    cell: ({ row }) => {
      const score = row.getValue("score") as number;
      const maxScore = row.original.maxScore;
      return (
        <span className="text-sm font-mono">
          {score}
          <span className="text-muted-foreground">/{maxScore}</span>
        </span>
      );
    },
  },
  {
    accessorKey: "time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
    cell: ({ row }) => {
      const time = row.getValue("time") as string;
      return (
        <span className="text-sm font-mono text-muted-foreground">
          {time === "N/A" ? "N/A" : `${time}s`}
        </span>
      );
    },
  },
  {
    accessorKey: "submissionTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue("submissionTime")}
      </span>
    ),
  },
];

interface SubmissionManagementTableProps {
  data: SubmissionRow[];
}

export function SubmissionManagementTable({ data }: SubmissionManagementTableProps) {
  return (
    <DataTable
      columns={submissionColumns}
      data={data}
      searchKey="username"
      searchPlaceholder="Search by username..."
    />
  );
}
