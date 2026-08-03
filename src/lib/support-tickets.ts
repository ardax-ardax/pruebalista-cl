import { supabase } from "@/integrations/supabase/client";

export type TicketCategory = "bug" | "duda" | "mejora" | "cuenta";
export type TicketStatus = "open" | "closed";

export interface SupportTicket {
  id: string;
  user_id: string;
  message: string;
  category: TicketCategory;
  page_url: string | null;
  user_agent: string | null;
  role: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketWithUser extends SupportTicket {
  email: string | null;
  display_name: string | null;
}

const CATEGORIES: Record<TicketCategory, string> = {
  bug: "Error/Bug",
  duda: "Duda",
  mejora: "Mejora",
  cuenta: "Problema de cuenta",
};

export const categoryLabel = (category: string) => CATEGORIES[category as TicketCategory] ?? category;

export const createSupportTicket = async (payload: {
  message: string;
  category: TicketCategory;
  page_url?: string | null;
  user_agent?: string | null;
  role?: string | null;
}): Promise<{ ok: boolean; error?: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    message: payload.message.trim(),
    category: payload.category,
    page_url: payload.page_url ?? null,
    user_agent: payload.user_agent ?? null,
    role: payload.role ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const listMyTickets = async (): Promise<{ tickets: SupportTicket[]; error: string | null }> => {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, message, category, page_url, user_agent, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMyTickets", error);
    return { tickets: [], error: error.message };
  }
  return { tickets: (data ?? []) as SupportTicket[], error: null };
};

export const listAllTickets = async (): Promise<{ tickets: SupportTicketWithUser[]; error: string | null }> => {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(`
      id, user_id, message, category, page_url, user_agent, role, status, created_at, updated_at,
      profiles!inner(email, display_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listAllTickets", error);
    return { tickets: [], error: error.message };
  }

  const tickets = (data ?? []).map((r) => {
    const profile = (r as unknown as Record<string, unknown>).profiles as
      | { email: string | null; display_name: string | null }
      | null;
    return {
      ...(r as SupportTicket),
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
    };
  });

  return { tickets, error: null };
};

export const updateTicketStatus = async (
  id: string,
  status: TicketStatus,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
