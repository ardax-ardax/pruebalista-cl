import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  label: string;
  max_assessments: number | null;
  max_assignments: number | null;
  can_export_docx: boolean;
  show_watermark: boolean;
  can_edit_layout: boolean;
  can_use_omr: boolean;
  can_use_response_sheet: boolean;
  allowed_templates: string[] | null;
  default_credits: number;
  is_default: boolean;
  sort_order: number;
}

const DEFAULT_PLAN_LIMITS: Plan = {
  id: "free",
  label: "Free",
  max_assessments: 10,
  max_assignments: 5,
  can_export_docx: false,
  show_watermark: true,
  can_edit_layout: true,
  can_use_omr: false,
  can_use_response_sheet: false,
  allowed_templates: null,
  default_credits: 20,
  is_default: true,
  sort_order: 0,
};

interface PlansContextType {
  plans: Plan[];
  loading: boolean;
  getPlan: (id: string) => Plan;
  refresh: () => Promise<void>;
}

const PlansContext = createContext<PlansContextType>({
  plans: [],
  loading: true,
  getPlan: () => DEFAULT_PLAN_LIMITS,
  refresh: async () => {},
});

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) {
      setPlans(data as unknown as Plan[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPlan = useCallback(
    (id: string): Plan => plans.find((p) => p.id === id) ?? DEFAULT_PLAN_LIMITS,
    [plans],
  );

  return (
    <PlansContext.Provider value={{ plans, loading, getPlan, refresh }}>
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans() {
  return useContext(PlansContext);
}
