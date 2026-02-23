import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "~/types/database";

// Re-export for backwards compatibility
export type { UserRole };

export interface User {
  userId: string;
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  user: User | null;
  children: ReactNode;
}

export function AuthProvider({ user, children }: AuthProviderProps) {
  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export function useUser(): User {
  const { user } = useAuth();

  if (!user) {
    throw new Error("useUser must be used when user is authenticated");
  }

  return user;
}

export function useOptionalUser(): User | null {
  const { user } = useAuth();
  return user;
}
