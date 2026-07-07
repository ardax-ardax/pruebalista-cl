import { supabase } from "@/integrations/supabase/client";

export type BillingCycle = "monthly" | "yearly";
export type PayablePlan = "pro" | "institucional";

export interface CreatePaymentInput {
  planId: PayablePlan;
  cycle: BillingCycle;
  seats?: number;
  colegioId?: string;
  successPath?: string;
}

export interface CreatePaymentResponse {
  url: string;
  token: string;
  orderId: string;
  amount: number;
  env: string;
}

export async function createFlowPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse> {
  const { data, error } = await supabase.functions.invoke<CreatePaymentResponse>("create-flow-payment", {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sin respuesta de la pasarela");
  // Some error shapes come inside data
  if ((data as unknown as { error?: string }).error) {
    throw new Error((data as unknown as { error: string }).error);
  }
  return data;
}

export interface InstitutionalTier {
  min_teachers: number;
  max_teachers: number | null;
  price_per_teacher_clp_monthly: number;
}

export async function loadInstitutionalTiers(): Promise<InstitutionalTier[]> {
  const { data } = await supabase
    .from("institutional_pricing_tiers")
    .select("min_teachers, max_teachers, price_per_teacher_clp_monthly")
    .order("min_teachers", { ascending: true });
  return (data ?? []) as InstitutionalTier[];
}

export function pickTier(tiers: InstitutionalTier[], seats: number): InstitutionalTier | null {
  return tiers.find((t) => seats >= t.min_teachers && (t.max_teachers == null || seats <= t.max_teachers)) ?? null;
}

export function computeInstitutionalAmount(tiers: InstitutionalTier[], seats: number, cycle: BillingCycle): number {
  const tier = pickTier(tiers, seats);
  if (!tier) return 0;
  const monthly = tier.price_per_teacher_clp_monthly * seats;
  return cycle === "monthly" ? monthly : monthly * 10;
}

export const formatCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
