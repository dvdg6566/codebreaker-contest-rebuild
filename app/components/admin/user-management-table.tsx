import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, UserX, Filter, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { DataTable } from "~/components/ui/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table-column-header";
import { UserAvatar } from "~/components/ui/user-avatar";
import { StatusBadge } from "~/components/ui/status-badge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Checkbox } from "~/components/ui/checkbox";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "Admin" | "Contestant";
  status: "active" | "inactive";
  lastActive: Date;
  createdAt: Date;
}

const roleVariants: Record<string, "admin" | "contestant" | "outline"> = {
  Admin: "admin",
  Contestant: "contestant",
};

export const userColumns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => {
      const user = row.original;
      return (
        <UserAvatar
          name={user.name}
          email={user.email}
          avatarUrl={user.avatar}
          showInfo
        />
      );
    },
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={roleVariants[role] ?? "outline"}>
          {role}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Edit user
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UserX className="mr-2 h-4 w-4" />
              {user.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface UserManagementTableProps {
  data: User[];
  onAddUser?: () => void;
}

export function UserManagementTable({ data, onAddUser }: UserManagementTableProps) {
  return (
    <DataTable
      columns={userColumns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search users..."
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" onClick={onAddUser}>
            <Plus className="mr-2 h-4 w-4" />
            Add user
          </Button>
        </div>
      }
    />
  );
}

