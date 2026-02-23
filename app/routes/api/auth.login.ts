import type { Route } from "./+types/auth.login";

export async function action({ request }: Route.ActionArgs) {
  const { login } = await import("~/lib/auth.server");
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = request.headers.get("Content-Type");

  let username: string;
  let password: string;

  if (contentType?.includes("application/json")) {
    const body = await request.json();
    username = body.username;
    password = body.password;
  } else {
    const formData = await request.formData();
    username = formData.get("username") as string;
    password = formData.get("password") as string;
  }

  if (!username || !password) {
    return Response.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  try {
    const { session, cookie } = await login(username, password);

    return Response.json(
      {
        user: {
          userId: session.userId,
          username: session.username,
          role: session.role,
        },
      },
      {
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }
}
