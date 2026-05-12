import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import * as authService from "../services/auth.service";
import { setAuthToken } from "../services/apiClient";

type AuthState = {
  user: User | null;
  token: string | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "cotizapp_token";
const USER_KEY = "cotizapp_user";

export function AuthProvider(props: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    setAuthToken(stored);
    return stored;
  });

  const [user, setUser] = useState<User | null>(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const value = useMemo<AuthState>(() => {
    return {
      user,
      token,
      login: async (input) => {
        const result = await authService.login(input);
        setToken(result.token);
        setUser(result.user);
        setAuthToken(result.token);
        sessionStorage.setItem(TOKEN_KEY, result.token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
      },
      logout: () => {
        setToken(null);
        setUser(null);
        setAuthToken(null);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      }
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthContext no inicializado");
  }
  return ctx;
}
