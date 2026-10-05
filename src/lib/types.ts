export type ProjectStatus = "active" | "paused" | "archived";

export type Project = {
  id: string;
  name: string;
  client: string | null;
  hourly_rate: number;
  currency: string;
  color: string;
  status: ProjectStatus;
  budget_hours: number | null;
  notes: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  project_id: string | null;
  date: string;
  description: string;
  hours: number;
  created_at: string;
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Activo",
  paused: "En pausa",
  archived: "Archivado",
};

export const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN"];

export const PROJECT_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#64748b",
];

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es", { style: "currency", currency }).format(amount);
}

export function formatHours(hours: number) {
  return `${Number(hours.toFixed(2))} h`;
}

// Supabase devuelve numeric como string; normalizamos a number.
export function toProject(row: Record<string, unknown>): Project {
  return {
    ...(row as Project),
    hourly_rate: Number(row.hourly_rate),
    budget_hours: row.budget_hours == null ? null : Number(row.budget_hours),
  };
}

export function toActivity(row: Record<string, unknown>): Activity {
  return { ...(row as Activity), hours: Number(row.hours) };
}

export function localISODate(d = new Date()) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
