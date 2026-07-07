import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { getMyProfile } from "@/lib/profiles";
import { supabase } from "@/integrations/supabase/client";

/**
 * Banner global: aparece cuando el plan pagado del usuario (o del colegio, si es UTP)
 * expira en ≤3 días o ya venció.
 */
export function PlanExpirationBanner() {
  const { user, role } = useAuth();
  const { planType, effectivePlan, planExpiresAt } = useUserUsage();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [colegioExpiry, setColegioExpiry] = useState<string | null>(null);
  const [isUtpOfCol, setIsUtpOfCol] = useState(false);

  useEffect(() => {
    if (!user || role !== "utp_head") return;
    getMyProfile().then(async (p) => {
      if (!p?.colegioId) return;
      const { data } = await supabase
        .from("colegios").select("plan_expires_at").eq("id", p.colegioId).maybeSingle();
      setColegioExpiry((data as { plan_expires_at: string | null } | null)?.plan_expires_at ?? null);
      setIsUtpOfCol(true);
    });
  }, [user?.id, role]);

  if (!user || dismissed) return null;

  // Choose relevant expiry: UTP → colegio; else user usage
  const relevantExpiry = isUtpOfCol ? colegioExpiry : planExpiresAt;
  const relevantPlan = isUtpOfCol ? "institucional" : planType;

  if (!relevantExpiry || relevantPlan === "free") return null;

  const exp = new Date(relevantExpiry).getTime();
  const now = Date.now();
  const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  const expired = exp < now;
  const soon = !expired && days <= 3;
  if (!expired && !soon) return null;

  const bg = expired ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white";
  const msg = expired
    ? (effectivePlan === "free"
        ? `Tu plan ${relevantPlan} venció. Volviste al plan Free — renueva para recuperar las funciones pagas.`
        : `Tu plan ${relevantPlan} venció recientemente. Renueva ahora para no perder acceso.`)
    : `Tu plan ${relevantPlan} vence en ${days} día${days === 1 ? "" : "s"}.`;

  return (
    <div className={`${bg} px-4 py-2.5 text-sm flex items-center justify-center gap-3 flex-wrap`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{msg}</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7"
        onClick={() => navigate("/precios")}
      >
        Renovar ahora
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 opacity-70 hover:opacity-100"
        aria-label="Ocultar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
