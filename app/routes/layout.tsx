import { Outlet, redirect } from "react-router";
import { AppLayout } from "~/components/layout/app-layout";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth, requireAdmin } = await import("~/lib/auth.server");

  // Require authentication for all routes inside this layout
  const session = await requireAuth(request);

  // Check if this is an admin route
  const url = new URL(request.url);
  if (url.pathname.startsWith("/admin")) {
    await requireAdmin(request);
  }

  return { user: session };
}

export default function Layout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
