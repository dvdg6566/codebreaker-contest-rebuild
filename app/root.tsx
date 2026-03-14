import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { AuthProvider, type User } from "~/context/auth-context";
import { WebSocketProvider } from "~/context/websocket-context";
import { ContestProvider } from "~/contexts/contest-context";
import type { Contest } from "~/types/database";

export async function loader({ request }: Route.LoaderArgs) {
  const { getCurrentUser } = await import("~/lib/auth.server");
  const session = await getCurrentUser(request);

  // Get WebSocket endpoint from environment
  const wsEndpoint = process.env.API_GATEWAY_LINK || null;

  if (!session) {
    return { user: null, wsEndpoint, userContests: [] };
  }

  const user: User = {
    userId: session.userId,
    username: session.username,
    role: session.role,
  };

  // Load user's active contests for the context
  let userContests: Contest[] = [];
  try {
    const { getUserActiveContests } = await import("~/lib/db/users.server");
    const { getContest } = await import("~/lib/contest.server");

    const activeContests = await getUserActiveContests(session.username);
    const contestIds = Object.keys(activeContests);

    userContests = await Promise.all(
      contestIds.map(async (contestId) => {
        try {
          return await getContest(contestId);
        } catch {
          return null;
        }
      })
    ).then(contests => contests.filter(Boolean) as Contest[]);
  } catch (error) {
    console.error("Failed to load user contests:", error);
  }

  return { user, wsEndpoint, userContests };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { user, wsEndpoint, userContests } = loaderData;

  return (
    <AuthProvider user={user}>
      <WebSocketProvider wsEndpoint={wsEndpoint}>
        <ContestProvider initialContests={userContests}>
          <Outlet />
        </ContestProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    // Handle authentication errors - redirect to login
    if (error.status === 401 || error.status === 302 || error.status === 303) {
      // Use window.location for client-side redirect
      if (typeof window !== "undefined") {
        window.location.href = "/login";
        return null;
      }
      // Server-side: show a login link
      return (
        <main className="pt-16 p-4 container mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
          <p className="mb-4">You need to be logged in to access this page.</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Go to Login
          </a>
        </main>
      );
    }

    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
