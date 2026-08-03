import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { usePlans } from "@/hooks/usePlans";
import { getMyProfile } from "@/lib/profiles";
import { loadPublicLandingSettings } from "@/lib/global-settings";
import {
  createFlowPayment,
  loadInstitutionalTiers,
  computeInstitutionalAmount,
  formatCLP,
  type InstitutionalTier,
  type BillingCycle,
} from "@/lib/flow-payments";


export default function Precios() {
  const { user, role } = useAuth();
  const { effectivePlan, planExpiresAt } = useUserUsage();
  const { plans } = usePlans();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [seats, setSeats] = useState(10);
  const [tiers, setTiers] = useState<InstitutionalTier[]>([]);
  const [colegioId, setColegioId] = useState<string | null>(null);
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingInst, setLoadingInst] = useState(false);
  const [showInstitutional, setShowInstitutional] = useState(true);

  const isUtp = role === "utp_head";
  const proPlan = plans.find((p) => p.id === "pro");

  useEffect(() => {
    loadInstitutionalTiers().then(setTiers);
    if (user) getMyProfile().then((p) => setColegioId(p?.colegioId ?? null));
    loadPublicLandingSettings().then((s) => setShowInstitutional(s.show_institutional_landing));
  }, [user?.id]);


  const proPrice = useMemo(() => {
    if (!proPlan) return 0;
    return cycle === "monthly" ? proPlan.price_clp_monthly ?? 7990 : proPlan.price_clp_yearly ?? 59990;
  }, [proPlan, cycle]);

  const institutionalPrice = useMemo(
    () => computeInstitutionalAmount(tiers, seats, cycle),
    [tiers, seats, cycle],
  );

  const handlePayPro = async () => {
    if (!user) return toast.error("Inicia sesión");
    setLoadingPro(true);
    try {
      const res = await createFlowPayment({ planId: "pro", cycle, successPath: "/perfil?paid=1" });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPro(false);
    }
  };

  const handlePayInst = async () => {
    if (!user) return toast.error("Inicia sesión");
    if (!colegioId) return toast.error("Debes tener un colegio asignado (rol UTP)");
    if (!isUtp) return toast.error("Solo el UTP puede contratar el plan institucional");
    setLoadingInst(true);
    try {
      const res = await createFlowPayment({
        planId: "institucional",
        cycle,
        seats,
        colegioId,
        successPath: "/configuracion?paid=1",
      });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingInst(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Planes y precios</h1>
          <p className="text-muted-foreground">Elige el plan que mejor se adapte a tu equipo docente.</p>
          {effectivePlan !== "free" && planExpiresAt && (
            <Badge variant="outline" className="mt-2">
              Tu plan actual expira el {new Date(planExpiresAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
            </Badge>
          )}
        </header>

        <div className="flex justify-center">
          <RadioGroup
            value={cycle}
            onValueChange={(v) => setCycle(v as BillingCycle)}
            className="inline-flex rounded-lg border p-1 bg-muted/40"
          >
            <label className={`px-4 py-1.5 rounded-md cursor-pointer text-sm font-medium ${cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <RadioGroupItem value="monthly" className="sr-only" /> Mensual
            </label>
            <label className={`px-4 py-1.5 rounded-md cursor-pointer text-sm font-medium flex items-center gap-1 ${cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <RadioGroupItem value="yearly" className="sr-only" /> Anual
              <Badge variant="secondary" className="text-[9px] ml-1">2 meses gratis</Badge>
            </label>
          </RadioGroup>
        </div>

        <div className={`grid gap-6 ${showInstitutional ? "md:grid-cols-3" : "md:grid-cols-2"}`}>

          {/* Free */}
          <Card>
            <CardHeader>
              <CardTitle>Gratis</CardTitle>
              <CardDescription>Para empezar a explorar.</CardDescription>
              <div className="text-3xl font-bold pt-2">$0</div>
            </CardHeader>
            <CardContent>
              <Feats items={[
                "Hasta 10 evaluaciones",
                "20 créditos IA mensuales",
                "Planilla de respuestas",
                "Marca de agua en PDF",
              ]} />
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                {effectivePlan === "free" ? "Tu plan actual" : "Incluido"}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="border-primary shadow-lg relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Más popular</Badge>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Pro</CardTitle>
              <CardDescription>Para docentes autónomos.</CardDescription>
              <div className="pt-2">
                <div className="text-3xl font-bold">{formatCLP(proPrice)}</div>
                <div className="text-xs text-muted-foreground">
                  {cycle === "monthly" ? "por mes" : `por año · equivale a ${formatCLP(Math.round(proPrice / 12))}/mes`}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Feats items={[
                "Hasta 100 evaluaciones",
                "200 créditos IA mensuales",
                "Exportar a DOCX",
                "Hoja de lectura óptica (OMR)",
                "Planilla de respuestas",
                "Sin marca de agua",
              ]} />
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handlePayPro} disabled={loadingPro}>
                {loadingPro ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {effectivePlan === "pro" ? "Renovar plan" : "Suscribirme"}
              </Button>
            </CardFooter>
          </Card>

          {/* Institucional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Institucional</CardTitle>
              <CardDescription>Colegios y equipos UTP.</CardDescription>
              <div className="pt-2">
                <div className="text-3xl font-bold">{formatCLP(institutionalPrice)}</div>
                <div className="text-xs text-muted-foreground">
                  {seats} docentes · {cycle === "monthly" ? "por mes" : "por año (10 meses)"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="seats" className="text-xs">Cantidad de docentes</Label>
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value || "1", 10)))}
                />
                <div className="text-[10px] text-muted-foreground">
                  Tramos: 1–10 $4.990 · 11–30 $3.990 · 31+ $2.990 por docente/mes
                </div>
              </div>
              <Feats items={[
                "Evaluaciones ilimitadas",
                "Todas las funciones Pro",
                "Branding del colegio",
                "Gestión centralizada por UTP",
              ]} />
            </CardContent>
            <CardFooter className="flex-col gap-2 items-stretch">
              <Button variant="secondary" className="w-full" onClick={handlePayInst} disabled={loadingInst || !isUtp}>
                {loadingInst ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isUtp ? "Contratar para mi colegio" : "Solo UTP puede contratar"}
              </Button>
              {!isUtp && (
                <p className="text-[10px] text-muted-foreground text-center">
                  ¿Representas a un colegio? Contáctanos para crear tu cuenta UTP.
                </p>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function Feats({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
