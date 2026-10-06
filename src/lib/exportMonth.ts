import type { SupabaseClient } from "@supabase/supabase-js";
import { toActivity, type Activity, type Project } from "@/lib/types";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

/** Últimos `count` meses en formato "YYYY-MM", del más reciente al más antiguo. */
export function recentMonths(count = 24) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** Rango de un mes completo a partir de "YYYY-MM". */
export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// Excel: máx. 31 caracteres, sin []:*?/\ y nombres únicos.
function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Proyecto";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Genera y descarga un Excel del mes: una hoja por proyecto con
 * Fecha, Actividad, Horas, Valor hora, Total y una fila de totales.
 * Devuelve false si no hay actividades en el mes.
 */
export async function exportMonthToExcel(
  supabase: SupabaseClient,
  month: string,
  projects: Project[],
) {
  const { from, to } = monthRange(month);
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("created_at");
  if (error) throw new Error(error.message);

  const activities = (data ?? []).map(toActivity);
  if (activities.length === 0) return false;

  const byProject = new Map<string | null, Activity[]>();
  for (const a of activities) {
    const list = byProject.get(a.project_id) ?? [];
    list.push(a);
    byProject.set(a.project_id, list);
  }

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const ordered = [...byProject.entries()].sort(([a], [b]) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return (projectsById.get(a)?.name ?? "").localeCompare(projectsById.get(b)?.name ?? "");
  });

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  const period = monthLabel(month);

  for (const [projectId, rows] of ordered) {
    const project = projectId ? projectsById.get(projectId) : undefined;
    const name = project?.name ?? "Sin proyecto";
    const rate = project?.hourly_rate ?? 0;
    const moneyFmt = `#,##0.00 "${project?.currency ?? "USD"}"`;

    const sheet = workbook.addWorksheet(sheetName(name, used), {
      views: [{ state: "frozen", ySplit: 3 }],
    });
    sheet.columns = [
      { key: "date", width: 12 },
      { key: "description", width: 60 },
      { key: "hours", width: 10 },
      { key: "rate", width: 16 },
      { key: "total", width: 18 },
    ];

    const title = sheet.addRow([`${name} — ${period}`]);
    title.font = { bold: true, size: 14 };
    sheet.mergeCells(1, 1, 1, 5);
    sheet.addRow([]);

    const header = sheet.addRow(["Fecha", "Actividad", "Horas", "Valor hora", "Total"]);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle" };
    });

    const firstDataRow = header.number + 1;
    for (const a of rows) {
      const row = sheet.addRow([
        new Date(`${a.date}T00:00:00Z`),
        a.description,
        a.hours,
        rate,
      ]);
      const r = row.number;
      row.getCell(5).value = { formula: `C${r}*D${r}`, result: a.hours * rate };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    }
    const lastDataRow = firstDataRow + rows.length - 1;

    const totalHours = rows.reduce((sum, a) => sum + a.hours, 0);
    const total = sheet.addRow(["Total", "", null, null, null]);
    total.getCell(3).value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})`, result: totalHours };
    total.getCell(5).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})`, result: totalHours * rate };
    total.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "thin" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });

    sheet.getColumn(1).numFmt = "dd/mm/yyyy";
    sheet.getColumn(3).numFmt = "#,##0.00";
    sheet.getColumn(4).numFmt = moneyFmt;
    sheet.getColumn(5).numFmt = moneyFmt;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `horas-${month}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
