"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, LICENSE_KEY_STORAGE_KEY, TOKEN_STORAGE_KEY } from "./api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  login: (licenseKey: string, employeeCode: string, pin: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // No dedicated "whoami" endpoint on this app (unlike the admin dashboard) — a stored token is
    // trusted optimistically here, and the first real dashboard fetch is what actually confirms
    // it's still valid, since requireOwnerAppAccess re-checks employee status/permission live on
    // every request anyway (see SERVER's middleware/mobile-auth.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(localStorage.getItem(TOKEN_STORAGE_KEY) ? "authenticated" : "unauthenticated");
  }, []);

  async function login(licenseKey: string, employeeCode: string, pin: string): Promise<void> {
    const result = await api.login(licenseKey, employeeCode, pin);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    // Remembered so this one-time, hard-to-type value is never asked for again on this phone —
    // only employee code + PIN on every subsequent sign-in.
    localStorage.setItem(LICENSE_KEY_STORAGE_KEY, licenseKey);
    setStatus("authenticated");
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setStatus("unauthenticated");
  }

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
