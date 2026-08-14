export function fmtGs(n) {
  if (n == null || isNaN(n)) return "Gs. 0";
  const rounded = Math.round(Number(n));
  return "Gs. " + rounded.toLocaleString("de-DE"); // uses dots as thousand separator
}

export function fmtNum(n) {
  if (n == null || isNaN(n)) return "0";
  return Math.round(Number(n)).toLocaleString("de-DE");
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const s = typeof iso === "string" ? iso.slice(0, 10) : iso;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MODALITIES = [
  { value: "diario", label: "Diario" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
];
