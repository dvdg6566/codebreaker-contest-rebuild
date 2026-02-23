import type { Route } from "./+types/auth.me";

export async function loader({ request }: Route.LoaderArgs) {
  const { getCurrentUser } = await import("~/lib/auth.server");
  const session = await getCurrentUser(request);

  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      userId: session.userId,
      username: session.username,
      role: session.role,
    },
  });
}
