import type { Route } from "./+types/users";
import {
  UserManagementTable,
  sampleUsers,
} from "~/components/admin/user-management-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Management - Codebreaker Admin" },
    { name: "description", content: "Manage users in the Codebreaker Contest Manager" },
  ];
}

export default function AdminUsersPage() {
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
          <UserManagementTable
            data={sampleUsers}
            onAddUser={() => {
              console.log("Add user clicked");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
