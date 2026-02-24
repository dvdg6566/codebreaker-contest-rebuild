import { useState } from "react";
import { data, redirect, useSubmit } from "react-router";
import type { Route } from "./+types/users";
import {
  UserManagementTable,
  type User as UIUser,
} from "~/components/admin/user-management-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { listUsers, createUser, deleteUser } from "~/lib/db/users.server";
import type { UserRole } from "~/types/database";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Management - Codebreaker Admin" },
    { name: "description", content: "Manage users in the Codebreaker Contest Manager" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const users = await listUsers();

  // Map database users to UI format
  const userList: UIUser[] = users.map((u) => ({
    id: u.username,
    name: u.fullname || u.username,
    email: u.email || "",
    role: u.role === "admin" ? "Admin" : "Contestant",
    status: "active" as const, // All users are active by default
    lastActive: new Date(),
    createdAt: new Date(),
  }));

  return { users: userList };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const username = formData.get("username") as string;
    const fullname = formData.get("fullname") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as UserRole;

    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return data({ error: "Invalid username" }, { status: 400 });
    }

    try {
      await createUser(username, role, { fullname, email });
      return { success: true };
    } catch (error) {
      return data({ error: "Username already exists" }, { status: 400 });
    }
  }

  if (intent === "delete") {
    const username = formData.get("username") as string;
    await deleteUser(username);
    return { success: true };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users } = loaderData;
  const submit = useSubmit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    fullname: "",
    email: "",
    role: "member" as UserRole,
  });

  const handleAddUser = () => {
    setDialogOpen(true);
  };

  const handleCreateUser = () => {
    const formData = new FormData();
    formData.set("intent", "create");
    formData.set("username", newUser.username);
    formData.set("fullname", newUser.fullname);
    formData.set("email", newUser.email);
    formData.set("role", newUser.role);
    submit(formData, { method: "POST" });
    setDialogOpen(false);
    setNewUser({ username: "", fullname: "", email: "", role: "member" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user accounts, roles, and permissions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            A list of all users in the system including their name, email, role, and status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementTable data={users} onAddUser={handleAddUser} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. Only letters, numbers, and underscores are allowed for usernames.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="e.g., john_doe"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullname" className="text-right">
                Full Name
              </Label>
              <Input
                id="fullname"
                value={newUser.fullname}
                onChange={(e) => setNewUser({ ...newUser, fullname: e.target.value })}
                placeholder="e.g., John Doe"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="e.g., john@example.com"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Contestant</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
