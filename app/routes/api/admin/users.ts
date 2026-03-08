import type { Route } from "./+types/users";
import { createUser, listUsers, type UserRole } from "~/lib/cognito.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  try {
    const users = await listUsers();
    return Response.json({ users });
  } catch (error) {
    console.error("Error listing users:", error);
    return Response.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = request.headers.get("Content-Type");

  let username: string;
  let password: string;
  let role: UserRole = "member";
  let email: string | undefined;

  if (contentType?.includes("application/json")) {
    const body = await request.json();
    username = body.username;
    password = body.password;
    role = body.role || "member";
    email = body.email;
  } else {
    const formData = await request.formData();
    username = formData.get("username") as string;
    password = formData.get("password") as string;
    role = (formData.get("role") as UserRole) || "member";
    email = formData.get("email") as string | undefined;
  }

  if (!username || !password) {
    return Response.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    const user = await createUser(username, password, role, email);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create user";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
