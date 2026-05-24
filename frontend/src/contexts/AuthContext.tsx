import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "parent" | "driver" | "admin";
  phone?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (params: {
    email: string;
    password: string;
    full_name: string;
    role: "parent" | "driver" | "admin";
    phone?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await storage.secureGet("tz_token", "");
      if (token) {
        const me = await api.get<User>("/auth/me");
        setUser(me);
      }
    } catch {
      await storage.secureRemove("tz_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Once we have a user, register for push notifications (no-op on web/Expo Go).
  useEffect(() => {
    if (user) {
      registerForPushAsync().catch(() => null);
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>(
      "/auth/login",
      { email, password },
      false,
    );
    await storage.secureSet("tz_token", res.access_token);
    setUser(res.user);
    return res.user;
  };

  const signUp: AuthState["signUp"] = async (params) => {
    const res = await api.post<{ access_token: string; user: User }>(
      "/auth/register",
      params,
      false,
    );
    await storage.secureSet("tz_token", res.access_token);
    setUser(res.user);
    return res.user;
  };

  const signOut = async () => {
    await storage.secureRemove("tz_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
