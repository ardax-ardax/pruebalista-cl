import { useEffect, useState } from "react";
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
}

const DEFAULT_USAGE: UserUsage = {
  creditsAvailable: 20,
  planType: "free",
  effectivePlan: "free",
  planExpiresAt: null,
  lastReset: "",
};

function computeEffectivePlan(planType: PlanType, expiresAt: string | null): PlanType {
  if (planType === "free") return "free";
  if (!expiresAt) return planType; // no expiry → active forever
  return new Date(expiresAt) > new Date() ? planType : "free";
}

export function useUserUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_usage")
      .select("credits_available, plan_type, last_reset, plan_expires_at")
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
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user?.id]);

  return { ...usage, loading, refresh };
}
