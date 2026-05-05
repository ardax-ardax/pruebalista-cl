import { getMyProfile } from "@/lib/profiles";

/**
 * Given a user's role, resolve the correct post-login destination.
 * - admin → /admin/dashboard
 * - utp_head → /configuracion
 * - docente with colegio_id → / (dashboard docente institucional)
 * - docente without colegio_id → /crear-prueba (independiente)
 */
export async function resolveDestination(role: string | null): Promise<string> {
  if (role === "admin") return "/admin/dashboard";
  if (role === "utp_head") return "/configuracion";

  // docente (or null role): check if institutional
  try {
    const profile = await getMyProfile();
    if (profile?.colegioId) return "/docente/dashboard";
  } catch {
    // fallback
  }
  return "/crear-prueba";
}
