import { redirect } from "react-router";
import type { Route } from "./+types/auth.logout";

export async function action({ request }: Route.ActionArgs) {
  const { logout } = await import("~/lib/auth.server");
  const cookie = await logout();

  // Check if this is a JSON request or form submission
  const acceptHeader = request.headers.get("Accept");
  const isJsonRequest = acceptHeader?.includes("application/json");

  if (isJsonRequest) {
    return Response.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  }

  // For form submissions, redirect to login
  return redirect("/login", {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

export async function loader() {
  // Redirect GET requests to login
  return redirect("/login");
}
