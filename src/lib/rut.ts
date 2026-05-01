// Utilidades para Rol Único Tributario (RUT) chileno.
// Limpia (elimina puntos, guiones, espacios), normaliza a mayúscula
// el dígito verificador (K) y valida con módulo 11.

/** Elimina puntos, guiones y espacios; uppercases la K final. */
export function cleanRut(input: string): string {
  if (!input) return "";
  return input
    .replace(/[.\-\s]/g, "")
    .toUpperCase();
}

/** Calcula el dígito verificador esperado para un cuerpo numérico. */
function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

/** Devuelve true si el RUT (limpio o no) es estructuralmente válido. */
export function isValidRut(input: string): boolean {
  const c = cleanRut(input);
  if (!/^\d{7,8}[0-9K]$/.test(c)) return false;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  return computeDv(body) === dv;
}

/** Formatea un RUT limpio como "12.345.678-9". */
export function formatRut(input: string): string {
  const c = cleanRut(input);
  if (c.length < 2) return c;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
