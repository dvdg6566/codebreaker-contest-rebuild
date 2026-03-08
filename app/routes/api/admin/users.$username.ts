import type { Route } from "./+types/users.$username";
import {
  getUser,
  deleteUser,
  changePassword,
  updateUserRole,
  updateUserEmail,
  type UserRole,
} from "~/lib/cognito.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const { username } = params;

  if (!username) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const user = await getUser(username);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    console.error("Error getting user:", error);
    return Response.json({ error: "Failed to get user" }, { status: 500 });
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const { username } = params;

  if (!username) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  // Handle DELETE request
  if (request.method === "DELETE") {
    try {
      await deleteUser(username);
      return Response.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      return Response.json({ error: "Failed to delete user" }, { status: 500 });
    }
  }

  // Handle PUT/PATCH request for updates
  if (request.method === "PUT" || request.method === "PATCH") {
    const contentType = request.headers.get("Content-Type");

    let password: string | undefined;
    let role: UserRole | undefined;
    let email: string | undefined;

    if (contentType?.includes("application/json")) {
      const body = await request.json();
      password = body.password;
      role = body.role;
      email = body.email;
    } else {
      const formData = await request.formData();
      password = formData.get("password") as string | undefined;
      role = formData.get("role") as UserRole | undefined;
      email = formData.get("email") as string | undefined;
    }

    try {
      if (password) {
        await changePassword(username, password);
      }

      if (role) {
        await updateUserRole(username, role);
      }

      if (email) {
        await updateUserEmail(username, email);
      }

      const user = await getUser(username);
      return Response.json({ user });
    } catch (error) {
      console.error("Error updating user:", error);
      return Response.json({ error: "Failed to update user" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
