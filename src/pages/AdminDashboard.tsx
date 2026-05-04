import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePlans } from "@/hooks/usePlans";
import { supabase } from "@/integrations/supabase/client";
import { loadGlobalSettings, updateGlobalSettings, type GlobalSettings } from "@/lib/global-settings";
import { toast } from "sonner";
import { format } from "date-fns";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, CreditCard, Loader2, Package, RefreshCw, Save, Search, Settings2, Shield, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PlansManager from "@/components/admin/PlansManager";

/* ───────── Types ───────── */
interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  plan_type: string;
  credits_available: number;
  plan_expires_at: string | null;
}

/* ───────── Component ───────── */
export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { plans, getPlan } = usePlans();

  /* --- Global settings --- */
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadGlobalSettings().then(setSettings);
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const res = await updateGlobalSettings(settings);
    setSavingSettings(false);
    if (res.ok) toast.success("Ajustes globales guardados");
    else toast.error(res.error ?? "Error al guardar");
  };

  /* --- Users --- */
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    setLoadingUsers(true);
    // Join profiles + user_usage
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name");
    const { data: usages } = await supabase.from("user_usage").select("user_id, plan_type, credits_available, plan_expires_at");

    if (profiles && usages) {
      const usageMap = new Map(usages.map((u) => [u.user_id, u]));
      const merged: UserRow[] = profiles.map((p) => {
        const u = usageMap.get(p.id);
        return {
          user_id: p.id,
          email: p.email,
          display_name: p.display_name,
          plan_type: u?.plan_type ?? "free",
          credits_available: u?.credits_available ?? 0,
          plan_expires_at: u?.plan_expires_at ?? null,
        };
      });
      setUsers(merged);
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.plan_type.includes(q),
    );
  }, [users, search]);

  /* --- Recharge dialog --- */
  const [rechargeUser, setRechargeUser] = useState<UserRow | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState(20);
  const [recharging, setRecharging] = useState(false);

  const handleRecharge = async () => {
    if (!rechargeUser) return;
    setRecharging(true);
    const { error } = await supabase
      .from("user_usage")
      .update({ credits_available: rechargeUser.credits_available + rechargeAmount })
      .eq("user_id", rechargeUser.user_id);
    setRecharging(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`+${rechargeAmount} créditos para ${rechargeUser.email}`);
    setRechargeUser(null);
    loadUsers();
  };

  /* --- Inline plan change --- */
  const handlePlanChange = async (userId: string, newPlan: string) => {
    const planConfig = getPlan(newPlan);
    const defaultPlan = plans.find((p) => p.is_default);
    const isDefault = newPlan === defaultPlan?.id;
    // If non-default plan, set expiry to 1 month from now; if default, clear expiry
    const expiresAt = isDefault ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("user_usage")
      .update({ plan_type: newPlan, credits_available: planConfig.default_credits, plan_expires_at: expiresAt })
      .eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Plan actualizado a ${planConfig.label} (${planConfig.default_credits} créditos)`);
    loadUsers();
  };

  /* --- Expiry date --- */
  const [expiryUser, setExpiryUser] = useState<UserRow | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();

  const handleSetExpiry = async () => {
    if (!expiryUser) return;
    const { error } = await supabase
      .from("user_usage")
      .update({ plan_expires_at: expiryDate ? expiryDate.toISOString() : null })
      .eq("user_id", expiryUser.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(expiryDate ? "Fecha de expiración establecida" : "Expiración removida");
    setExpiryUser(null);
    loadUsers();
  };

  /* --- Bulk plan assign --- */
  const [bulkPlan, setBulkPlan] = useState("institucional");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (uid: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUsers.size === filtered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map((u) => u.user_id)));
    }
  };

  const handleBulkPlanAssign = async () => {
    if (selectedUsers.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedUsers);
    const planConfig = getPlan(bulkPlan);
    const promises = ids.map((uid) =>
      supabase.from("user_usage").update({ plan_type: bulkPlan, credits_available: planConfig.default_credits }).eq("user_id", uid),
    );
    await Promise.all(promises);
    setBulkLoading(false);
    toast.success(`${ids.length} usuario(s) actualizados a ${planConfig.label} (${planConfig.default_credits} créditos)`);
    setSelectedUsers(new Set());
    loadUsers();
  };

  if (!isAdmin) return null;

  const planBadge = (planId: string) => {
    const p = getPlan(planId);
    return <Badge variant="outline" className="text-[10px]">{p.label}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
        </div>

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" /> Ajustes</TabsTrigger>
            <TabsTrigger value="plans" className="gap-2"><Package className="h-4 w-4" /> Planes</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Usuarios</TabsTrigger>
            <TabsTrigger value="institutions" className="gap-2"><CreditCard className="h-4 w-4" /> Instituciones</TabsTrigger>
          </TabsList>

          {/* ──── Settings Tab ──── */}
          <TabsContent value="settings" className="space-y-4">
            {settings && (
              <Card>
                <CardHeader>
                  <CardTitle>Ajustes Globales</CardTitle>
                  <CardDescription>Controles del modelo de negocio y mantenimiento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Pagos habilitados</Label>
                      <p className="text-sm text-muted-foreground">Activa/desactiva la pasarela de pagos globalmente</p>
                    </div>
                    <Switch
                      checked={settings.enable_payments}
                      onCheckedChange={(v) => setSettings({ ...settings, enable_payments: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Modo mantenimiento</Label>
                      <p className="text-sm text-muted-foreground">Muestra aviso de mantenimiento a los usuarios</p>
                    </div>
                    <Switch
                      checked={settings.maintenance_mode}
                      onCheckedChange={(v) => setSettings({ ...settings, maintenance_mode: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Generación con IA
                      </Label>
                      <p className="text-sm text-muted-foreground">Activa/desactiva la IA para todos los usuarios de la plataforma</p>
                    </div>
                    <Switch
                      checked={settings.ai_enabled}
                      onCheckedChange={(v) => setSettings({ ...settings, ai_enabled: v })}
                    />
                  </div>
                  {!settings.ai_enabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-destructive/30">
                      <Label className="font-medium">Motivo de desactivación</Label>
                      <Input
                        placeholder="Ej: Mantenimiento programado, Período de evaluaciones..."
                        value={settings.ai_disabled_reason}
                        onChange={(e) => setSettings({ ...settings, ai_disabled_reason: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Este mensaje será visible para los usuarios cuando intenten usar la IA.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="font-medium">Créditos IA iniciales (nuevos usuarios)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.default_free_credits}
                      onChange={(e) => setSettings({ ...settings, default_free_credits: Number(e.target.value) })}
                      className="w-32"
                    />
                  </div>
                  <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                    {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar ajustes
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ──── Plans Tab ──── */}
          <TabsContent value="plans" className="space-y-4">
            <PlansManager />
          </TabsContent>

          {/* ──── Users Tab ──── */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>{users.length} usuarios registrados</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por email o nombre..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button variant="outline" size="icon" onClick={loadUsers} title="Recargar">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                     <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-center">Créditos</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Select value={u.plan_type} onValueChange={(v) => handlePlanChange(u.user_id, v)}>
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {plans.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">{u.credits_available}</TableCell>
                          <TableCell className="text-sm">
                            {u.plan_expires_at ? format(new Date(u.plan_expires_at), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="outline" onClick={() => { setRechargeUser(u); setRechargeAmount(20); }}>
                              + Créditos
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setExpiryUser(u); setExpiryDate(u.plan_expires_at ? new Date(u.plan_expires_at) : undefined); }}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" /> Expiración
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Sin resultados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──── Institutions Tab ──── */}
          <TabsContent value="institutions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Asignación Masiva — Plan Institucional</CardTitle>
                <CardDescription>
                  Selecciona los usuarios a los que deseas asignar el plan Institucional de forma masiva.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar usuarios..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={bulkPlan} onValueChange={setBulkPlan}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleBulkPlanAssign}
                    disabled={selectedUsers.size === 0 || bulkLoading}
                    className="gap-2"
                  >
                    {bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Asignar plan ({selectedUsers.size})
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedUsers.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <Checkbox checked={selectedUsers.has(u.user_id)} onCheckedChange={() => toggleSelect(u.user_id)} />
                        </TableCell>
                        <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                        <TableCell>{planBadge(u.plan_type)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ──── Recharge Dialog ──── */}
      <Dialog open={!!rechargeUser} onOpenChange={() => setRechargeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recargar Créditos IA</DialogTitle>
            <DialogDescription>
              {rechargeUser?.email} — Saldo actual: {rechargeUser?.credits_available}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Cantidad a agregar</Label>
            <Input type="number" min={1} value={rechargeAmount} onChange={(e) => setRechargeAmount(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeUser(null)}>Cancelar</Button>
            <Button onClick={handleRecharge} disabled={recharging} className="gap-2">
              {recharging && <Loader2 className="h-4 w-4 animate-spin" />}
              Recargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──── Expiry Dialog ──── */}
      <Dialog open={!!expiryUser} onOpenChange={() => setExpiryUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fecha de Expiración del Plan</DialogTitle>
            <DialogDescription>{expiryUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <Calendar
              mode="single"
              selected={expiryDate}
              onSelect={setExpiryDate}
              className={cn("p-3 pointer-events-auto")}
            />
            {expiryDate && (
              <Button variant="ghost" size="sm" onClick={() => setExpiryDate(undefined)} className="gap-1">
                <X className="h-3 w-3" /> Quitar fecha
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiryUser(null)}>Cancelar</Button>
            <Button onClick={handleSetExpiry}>
              {expiryDate ? "Establecer" : "Quitar expiración"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
