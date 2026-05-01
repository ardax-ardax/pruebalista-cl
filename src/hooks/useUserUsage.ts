import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PlanType = "free" | "pro" | "institucional";

export interface UserUsage {
  creditsAvailable: number;
  planType: PlanType;
  lastReset: string;
}

const DEFAULT_USAGE: UserUsage = { creditsAvailable: 20, planType: "free", lastReset: "" };

export function useUserUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_usage")
      .select("credits_available, plan_type, last_reset")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setUsage({
        creditsAvailable: data.credits_available,
        planType: data.plan_type as PlanType,
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
