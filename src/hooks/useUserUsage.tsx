import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PlanType = "free" | "pro" | "institucional";

export interface UserUsage {
  creditsAvailable: number;
  planType: PlanType;
  /** Effective plan considering expiration */
  effectivePlan: PlanType;
  planExpiresAt: string | null;
  lastReset: string;
  monthlyQuota: number | null;
}

const DEFAULT_USAGE: UserUsage = {
  creditsAvailable: 20,
  planType: "free",
  effectivePlan: "free",
  planExpiresAt: null,
  lastReset: "",
  monthlyQuota: null,
};

function computeEffectivePlan(planType: PlanType, expiresAt: string | null): PlanType {
  if (planType === "free") return "free";
  if (!expiresAt) return planType;
  return new Date(expiresAt) > new Date() ? planType : "free";
}

interface UserUsageContextType extends UserUsage {
  loading: boolean;
  refresh: () => Promise<void>;
}

const UserUsageContext = createContext<UserUsageContextType>({
  ...DEFAULT_USAGE,
  loading: true,
  refresh: async () => {},
});

export function UserUsageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_usage")
      .select("credits_available, plan_type, last_reset, plan_expires_at, monthly_quota")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const pt = data.plan_type as PlanType;
      setUsage({
        creditsAvailable: data.credits_available,
        planType: pt,
        effectivePlan: computeEffectivePlan(pt, data.plan_expires_at),
        planExpiresAt: data.plan_expires_at,
        lastReset: data.last_reset,
        monthlyQuota: data.monthly_quota ?? null,
      });
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user?.id, refresh]);

  return (
    <UserUsageContext.Provider value={{ ...usage, loading, refresh }}>
      {children}
    </UserUsageContext.Provider>
  );
}

export function useUserUsage() {
  return useContext(UserUsageContext);
}
