import { useEffect, useState, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile, type Profile } from "@/lib/profiles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImagePlus, Loader2, Save, Trash2, User } from "lucide-react";

export default function Perfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) {
        setProfile(p);
        setInstitutionName(p.customInstitutionName ?? "");
        setLogoUrl(p.customLogoUrl);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateMyProfile({
      custom_institution_name: institutionName.trim() || null,
      custom_logo_url: logoUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
    } else {
      toast.error("Error: " + res.error);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es muy grande (máx. 2 MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage
      .from("user-logos")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Error al subir: " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("user-logos").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now(); // cache bust
    setLogoUrl(url);
    setUploading(false);
    toast.success("Logo subido");
  };

  const handleRemoveLogo = async () => {
    if (!user) return;
    // Remove from storage (best-effort)
    await supabase.storage.from("user-logos").remove([`${user.id}/logo.png`, `${user.id}/logo.jpg`, `${user.id}/logo.jpeg`, `${user.id}/logo.webp`]);
    setLogoUrl(null);
    toast.info("Logo eliminado. Recuerda guardar.");
  };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = (meta.full_name as string) || (meta.name as string) || user?.email?.split("@")[0] || "Usuario";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el nombre de tu colegio y logo. Estos datos aparecerán en el encabezado de tus evaluaciones.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> Datos personales
            </CardTitle>
            <CardDescription>Tu información de cuenta (no editable aquí)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {(meta.avatar_url || meta.picture) && (
                <AvatarImage src={(meta.avatar_url as string) || (meta.picture as string)} alt={displayName} />
              )}
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{displayName}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branding de evaluaciones</CardTitle>
            <CardDescription>
              Estos datos reemplazan el encabezado del colegio por defecto en tus pruebas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Nombre de tu colegio</Label>
              <Input
                id="inst-name"
                placeholder="Ej: Colegio San Patricio"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío, se usará el nombre predeterminado del sistema.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Logo de tu colegio</Label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg border border-border object-contain bg-background p-1"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadLogo}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                    {logoUrl ? "Cambiar logo" : "Subir logo"}
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo}>
                      <Trash2 className="h-4 w-4 mr-1" /> Quitar logo
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Formato JPG o PNG, máximo 2 MB. Se mostrará en el encabezado de tus pruebas.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar cambios
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
