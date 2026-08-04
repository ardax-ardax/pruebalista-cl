import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { loadGlobalSettings, updateGlobalSettings, type GlobalSettings } from "@/lib/global-settings";
import { categoryLabel, listAllTickets, updateTicketStatus, type SupportTicketWithUser, type TicketStatus } from "@/lib/support-tickets";
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
import { BookOpen, FileStack, FileUp, GraduationCap, Library, Loader2, MessageSquare, Package, RefreshCw, Save, Search, Settings2, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import PlansManager from "@/components/admin/PlansManager";
import AdminCoursesManager from "@/components/admin/AdminCoursesManager";
import AdminSubjectsManager from "@/components/admin/AdminSubjectsManager";
import CurriculumBulkImporter from "@/components/admin/CurriculumBulkImporter";
import BancoPreguntas from "@/pages/BancoPreguntas";
import MisPruebas from "@/pages/MisPruebas";
import { ErrorBoundary } from "@/components/ErrorBoundary";


/* ───────── Component ───────── */
export default function AdminDashboard() {
  const { isAdmin } = useAuth();

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

  /* --- Support tickets --- */
  const [tickets, setTickets] = useState<SupportTicketWithUser[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | "all">("all");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>("all");
  const [ticketSearch, setTicketSearch] = useState("");

  const loadTickets = async () => {
    setLoadingTickets(true);
    const { tickets, error } = await listAllTickets();
    if (error) toast.error(error);
    setTickets(tickets);
    setLoadingTickets(false);
  };

  useEffect(() => {
    if (isAdmin) loadTickets();
  }, [isAdmin]);

  const handleToggleTicketStatus = async (id: string, current: TicketStatus) => {
    const next = current === "open" ? "closed" : "open";
    const res = await updateTicketStatus(id, next);
    if (res.ok) {
      toast.success(`Ticket marcado como ${next === "open" ? "abierto" : "cerrado"}`);
      loadTickets();
    } else {
      toast.error(res.error ?? "No se pudo actualizar");
    }
  };

  const filteredTickets = useMemo(() => {
    let rows = tickets;
    if (ticketStatusFilter !== "all") rows = rows.filter((t) => t.status === ticketStatusFilter);
    if (ticketCategoryFilter !== "all") rows = rows.filter((t) => t.category === ticketCategoryFilter);
    if (ticketSearch.trim()) {
      const q = ticketSearch.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.message.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.display_name?.toLowerCase().includes(q) ||
          categoryLabel(t.category).toLowerCase().includes(q),
      );
    }
    return rows;
  }, [tickets, ticketStatusFilter, ticketCategoryFilter, ticketSearch]);

  const categories = useMemo(() => {
    const set = new Set(tickets.map((t) => t.category));
    return ["all", ...Array.from(set)];
  }, [tickets]);

  if (!isAdmin) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
        </div>

        <Tabs defaultValue="settings">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" /> Ajustes</TabsTrigger>
            <TabsTrigger value="plans" className="gap-2"><Package className="h-4 w-4" /> Planes</TabsTrigger>
            <TabsTrigger value="subjects" className="gap-2"><BookOpen className="h-4 w-4" /> Asignaturas</TabsTrigger>
            <TabsTrigger value="courses" className="gap-2"><GraduationCap className="h-4 w-4" /> Cursos</TabsTrigger>
            <TabsTrigger value="curriculum-import" className="gap-2"><FileUp className="h-4 w-4" /> Importar Currículum</TabsTrigger>
            <TabsTrigger value="bank" className="gap-2"><Library className="h-4 w-4" /> Banco de Preguntas</TabsTrigger>
            <TabsTrigger value="assessments" className="gap-2"><FileStack className="h-4 w-4" /> Todas las Pruebas</TabsTrigger>
            <TabsTrigger value="support" className="gap-2"><MessageSquare className="h-4 w-4" /> Soporte</TabsTrigger>
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
                      <Label className="font-medium">Módulo institucional (UTP) en la portada</Label>
                      <p className="text-sm text-muted-foreground">
                        Si lo desactivas, la portada pública se muestra como servicio individual (sin menciones a UTP/colegios ni plan institucional). Los usuarios UTP siguen ingresando con normalidad.
                      </p>
                    </div>
                    <Switch
                      checked={settings.show_institutional_landing}
                      onCheckedChange={(v) => setSettings({ ...settings, show_institutional_landing: v })}
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


          {/* ──── Courses Tab ──── */}
          <TabsContent value="subjects" className="space-y-4">
            <AdminSubjectsManager />
          </TabsContent>

          <TabsContent value="courses" className="space-y-4">
            <AdminCoursesManager />
          </TabsContent>

          <TabsContent value="curriculum-import" className="space-y-4">
            <CurriculumBulkImporter />
          </TabsContent>

          {/* ──── Banco de Preguntas Tab ──── */}
          <TabsContent value="bank" className="space-y-4">
            <ErrorBoundary fallbackTitle="No pudimos cargar el banco de preguntas">
              <BancoPreguntas embedded />
            </ErrorBoundary>
          </TabsContent>

          {/* ──── Todas las Pruebas Tab ──── */}
          <TabsContent value="assessments" className="space-y-4">
            <ErrorBoundary fallbackTitle="No pudimos cargar las pruebas">
              <MisPruebas embedded />
            </ErrorBoundary>
          </TabsContent>




          {/* ──── Support Tab ──── */}
          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Soporte y Feedback</CardTitle>
                    <CardDescription>Tickets reportados por usuarios desde el Centro de Ayuda.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadTickets} disabled={loadingTickets} className="gap-2">
                    <RefreshCw className={cn("h-4 w-4", loadingTickets && "animate-spin")} />
                    Recargar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar ticket..."
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={ticketStatusFilter} onValueChange={(v) => setTicketStatusFilter(v as TicketStatus | "all")}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="open">Abiertos</SelectItem>
                        <SelectItem value="closed">Cerrados</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={ticketCategoryFilter} onValueChange={setTicketCategoryFilter}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas categorías</SelectItem>
                        {categories.filter((c) => c !== "all").map((c) => (
                          <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loadingTickets ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Estado</TableHead>
                          <TableHead className="w-[120px]">Categoría</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Mensaje</TableHead>
                          <TableHead className="w-[140px]">Fecha</TableHead>
                          <TableHead className="w-[100px]">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTickets.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <Badge variant={t.status === "open" ? "default" : "secondary"} className="text-[10px]">
                                {t.status === "open" ? "Abierto" : "Cerrado"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{categoryLabel(t.category)}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{t.display_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{t.email || t.user_id}</div>
                              {t.role && <div className="text-[10px] text-muted-foreground mt-0.5">Rol: {t.role}</div>}
                            </TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <p className="line-clamp-3" title={t.message}>{t.message}</p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleTicketStatus(t.id, t.status)}
                              >
                                {t.status === "open" ? "Cerrar" : "Reabrir"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredTickets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Sin tickets por mostrar
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>

  );
}
