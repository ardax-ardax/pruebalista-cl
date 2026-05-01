// Panel de Gestión de Consumo IA para UTP / Admin.
// Muestra créditos, cuota mensual, evaluaciones y generaciones IA por docente.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BarChart3, Download, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";

interface UsageRow {
  user_id: string;
  credits_available: number;
  plan_type: string;
  monthly_quota: number | null;
}

interface AuditRow {
  userId: string;
  email: string;
  displayName: string;
  credits: number;
  planType: string;
  monthlyQuota: number | null;
  assessmentCount: number;
  aiGenerations: number;
}

export const UtpUsageManager = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuota, setEditingQuota] = useState<Record<string, string>>({});
  const [editingCredits, setEditingCredits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [profilesRes, usageRes, assessmentsRes, aiLogRes] = await Promise.all([
        listProfiles(),
        supabase.from("user_usage").select("user_id, credits_available, plan_type, monthly_quota"),
        supabase.from("assessments").select("user_id"),
        supabase.from("ai_generation_log").select("user_id"),
      ]);

      const profiles = profilesRes.profiles;
      const usageData = (usageRes.data ?? []) as UsageRow[];
      const assessments = assessmentsRes.data ?? [];
      const aiLogs = aiLogRes.data ?? [];

      // Count assessments per user
      const assessmentCounts = new Map<string, number>();
      for (const a of assessments) {
        assessmentCounts.set(a.user_id, (assessmentCounts.get(a.user_id) ?? 0) + 1);
      }

      // Count AI generations per user
      const aiCounts = new Map<string, number>();
      for (const l of aiLogs) {
        aiCounts.set(l.user_id, (aiCounts.get(l.user_id) ?? 0) + 1);
      }

      const usageMap = new Map<string, UsageRow>();
      for (const u of usageData) usageMap.set(u.user_id, u);

      const result: AuditRow[] = profiles.map((p: Profile) => {
        const usage = usageMap.get(p.id);
        return {
          userId: p.id,
          email: p.email ?? "",
          displayName: profileLabel(p, p.id),
          credits: usage?.credits_available ?? 0,
          planType: usage?.plan_type ?? "free",
          monthlyQuota: usage?.monthly_quota ?? null,
          assessmentCount: assessmentCounts.get(p.id) ?? 0,
          aiGenerations: aiCounts.get(p.id) ?? 0,
        };
      });

      setRows(result);
    } catch (e) {
      toast.error("Error al cargar datos: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleSetQuota = async (userId: string) => {
    const val = editingQuota[userId];
    if (val === undefined || val === "") return;
    const raw = parseInt(val, 10);
    if (isNaN(raw) || raw < 0) {
      toast.error("Ingresa un número válido (0 para quitar la cuota)");
      return;
    }
    const num = raw === 0 ? null : raw;
    setBusy(true);
    const { error } = await supabase
      .from("user_usage")
      .update({ monthly_quota: num })
      .eq("user_id", userId);
    setBusy(false);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success(num === null ? "Cuota eliminada" : `Cuota establecida a ${num}`);
    setEditingQuota((prev) => ({ ...prev, [userId]: "" }));
    await refresh();
  };

  const handleRechargeCredits = async (userId: string) => {
    const val = editingCredits[userId];
    if (!val) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      toast.error("Ingresa un número válido mayor a 0");
      return;
    }
    setBusy(true);
    const target = rows.find((r) => r.userId === userId);
    const newCredits = (target?.credits ?? 0) + num;
    const { error } = await supabase
      .from("user_usage")
      .update({ credits_available: newCredits })
      .eq("user_id", userId);
    setBusy(false);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success(`${num} créditos agregados (total: ${newCredits})`);
    setEditingCredits((prev) => ({ ...prev, [userId]: "" }));
    await refresh();
  };

  const handleDownloadCSV = () => {
    const header = "Docente,Email,Plan,Créditos,Cuota Mensual,Evaluaciones Creadas,Preguntas IA Generadas";
    const csvRows = rows.map((r) =>
      `"${r.displayName}","${r.email}","${r.planType}",${r.credits},${r.monthlyQuota ?? "Sin límite"},${r.assessmentCount},${r.aiGenerations}`
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumen_consumo_ia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  return (
    <Card className="shadow-card mb-8 border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Consumo de IA por Docente
            </CardTitle>
            <CardDescription>
              Gestiona créditos, cuotas mensuales y revisa el uso de IA de cada docente.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-2" disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" />
              Descargar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border max-h-[400px] overflow-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No hay docentes registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Docente</th>
                  <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Plan</th>
                  <th className="text-center font-medium px-3 py-2">
                    <span className="flex items-center gap-1 justify-center"><Sparkles className="h-3 w-3" /> Créditos</span>
                  </th>
                  <th className="text-center font-medium px-3 py-2">Cuota</th>
                  <th className="text-center font-medium px-3 py-2 hidden sm:table-cell">Evaluaciones</th>
                  <th className="text-center font-medium px-3 py-2 hidden sm:table-cell">Gen. IA</th>
                  <th className="text-center font-medium px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-t border-border">
                    <td className="px-3 py-1.5">
                      <div className="font-medium truncate max-w-[180px]">{r.displayName}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{r.email}</div>
                    </td>
                    <td className="px-3 py-1.5 hidden md:table-cell">
                      <Badge variant="secondary" className="text-[10px]">{r.planType}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono text-xs">{r.credits}</td>
                    <td className="px-3 py-1.5 text-center text-xs">
                      {r.monthlyQuota !== null ? (
                        <span className="font-mono">{r.monthlyQuota}</span>
                      ) : (
                        <span className="text-muted-foreground">∞</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono text-xs hidden sm:table-cell">{r.assessmentCount}</td>
                    <td className="px-3 py-1.5 text-center font-mono text-xs hidden sm:table-cell">{r.aiGenerations}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            placeholder="Cuota"
                            value={editingQuota[r.userId] ?? ""}
                            onChange={(e) => setEditingQuota((p) => ({ ...p, [r.userId]: e.target.value }))}
                            className="h-7 w-16 text-xs"
                          />
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={busy} onClick={() => handleSetQuota(r.userId)}>
                            Cuota
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            placeholder="+N"
                            value={editingCredits[r.userId] ?? ""}
                            onChange={(e) => setEditingCredits((p) => ({ ...p, [r.userId]: e.target.value }))}
                            className="h-7 w-16 text-xs"
                          />
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={busy} onClick={() => handleRechargeCredits(r.userId)}>
                            +Créditos
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Ingresa 0 en Cuota para quitar el límite. Los créditos se suman al saldo actual del docente.
        </p>
      </CardContent>
    </Card>
  );
};
