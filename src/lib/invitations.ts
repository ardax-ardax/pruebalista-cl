// Invitaciones pendientes por email. Cuando el usuario invitado inicie sesión
// por primera vez, el trigger handle_new_user le aplicará el rol indicado.
import { supabase } from "@/integrations/supabase/client";

export type InvitationRole = "admin" | "utp_head" | "user";

export interface PendingInvitation {
  id: string;
  email: string;
  role: InvitationRole;
  consumed_at: string | null;
  created_at: string;
}

export const listInvitations = async (): Promise<PendingInvitation[]> => {
  const { data, error } = await supabase
    .from("pending_invitations")
    .select("id, email, role, consumed_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listInvitations", error);
    return [];
  }
  return (data ?? []) as PendingInvitation[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkResult {
  inserted: number;
  skipped: number;
  invalid: string[];
}

export const bulkInviteEmails = async (
  raw: string,
  role: InvitationRole,
  invitedBy: string | null,
): Promise<{ ok: boolean; result?: BulkResult; error?: string }> => {
  // Aceptar separadores: nueva línea, coma, punto y coma, espacio.
  const tokens = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = Array.from(new Set(tokens));
  const valid = unique.filter((e) => EMAIL_RE.test(e));
  const invalid = unique.filter((e) => !EMAIL_RE.test(e));

  if (valid.length === 0) {
    return { ok: true, result: { inserted: 0, skipped: 0, invalid } };
  }

  const rows = valid.map((email) => ({ email, role, invited_by: invitedBy }));
  const { data, error } = await supabase
    .from("pending_invitations")
    .upsert(rows, { onConflict: "email", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, error: error.message };

  const inserted = data?.length ?? 0;
  return {
    ok: true,
    result: { inserted, skipped: valid.length - inserted, invalid },
  };
};

export const deleteInvitation = async (
  id: string,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from("pending_invitations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
