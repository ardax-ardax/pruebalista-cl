import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePlans } from "./usePlans";

export type PlanType = string;

export interface UserUsage {
  creditsAvailable: number;
  planType: PlanType;
  /** Effective plan considering expiration */
  effectivePlan: PlanType;
  planExpiresAt: string | null;
  lastReset: string;
  monthlyQuota: number | null;
  // Derived from plans table
  planLabel: string;
  maxAssessments: number | null;
  maxAssignments: number | null;
  canExportDocx: boolean;
  showWatermark: boolean;
  canEditLayout: boolean;
}

const DEFAULT_USAGE: UserUsage = {
  creditsAvailable: 20,
  planType: "free",
  effectivePlan: "free",
  planExpiresAt: null,
  lastReset: "",
  monthlyQuota: null,
  planLabel: "Free",
  maxAssessments: 10,
  maxAssignments: 5,
  canExportDocx: false,
  showWatermark: true,
  canEditLayout: true,
};

function computeEffectivePlan(planType: PlanType, expiresAt: string | null, defaultPlanId: string): PlanType {
  if (planType === defaultPlanId) return planType;
  if (!expiresAt) return planType;
  return new Date(expiresAt) > new Date() ? planType : defaultPlanId;
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
  const { getPlan, plans } = usePlans();
  const [rawData, setRawData] = useState<{
    creditsAvailable: number;
    planType: string;
    planExpiresAt: string | null;
    lastReset: string;
    monthlyQuota: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_usage")
      .select("credits_available, plan_type, last_reset, plan_expires_at, monthly_quota")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setRawData({
        creditsAvailable: data.credits_available,
        planType: data.plan_type,
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

  // Derive plan limits
  const defaultPlanId = plans.find((p) => p.is_default)?.id ?? "free";
  const pt = rawData?.planType ?? defaultPlanId;
  const effectivePlan = computeEffectivePlan(pt, rawData?.planExpiresAt ?? null, defaultPlanId);
  const planConfig = getPlan(effectivePlan);

  const usage: UserUsage = {
    creditsAvailable: rawData?.creditsAvailable ?? 20,
    planType: pt,
    effectivePlan,
    planExpiresAt: rawData?.planExpiresAt ?? null,
    lastReset: rawData?.lastReset ?? "",
    monthlyQuota: rawData?.monthlyQuota ?? null,
    planLabel: planConfig.label,
    maxAssessments: planConfig.max_assessments,
    maxAssignments: planConfig.max_assignments,
    canExportDocx: planConfig.can_export_docx,
    showWatermark: planConfig.show_watermark,
    canEditLayout: planConfig.can_edit_layout,
  };

  return (
    <UserUsageContext.Provider value={{ ...usage, loading, refresh }}>
      {children}
    </UserUsageContext.Provider>
  );
}

export function useUserUsage() {
  return useContext(UserUsageContext);
}
