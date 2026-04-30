import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppRole = "admin" | "utp_head" | "user";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAdmin: boolean;
  isUtpHead: boolean;
  /** Admin OR Jefe UTP. Permite supervisar y editar todo el colegio. */
  isStaff: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_PRIORITY: Record<AppRole, number> = { admin: 3, utp_head: 2, user: 1 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = (uid: string) => {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .then(({ data }) => {
          const roles = (data ?? []).map((r) => r.role as AppRole);
          if (roles.length === 0) {
            setRole(null);
            return;
          }
          const top = roles.reduce<AppRole>((acc, r) =>
            (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? r : acc, roles[0]);
          setRole(top);
        });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRole(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin";
  const isUtpHead = role === "utp_head";
  const isStaff = isAdmin || isUtpHead;

  return (
    <AuthContext.Provider
      value={{ user, session, role, isAdmin, isUtpHead, isStaff, loading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      session: null,
      role: null,
      isAdmin: false,
      isUtpHead: false,
      isStaff: false,
      loading: true,
      signInWithGoogle: async () => { /* noop */ },
      signOut: async () => { /* noop */ },
    };
  }
  return ctx;
}
