"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { ProjectForm } from "@/components/ProjectForm";
import { ProjectSelect } from "@/components/ProjectSelect";
import {
  formatHours, formatMoney, localISODate, toActivity, toProject,
  type Activity, type Project,
} from "@/lib/types";

type RangeKey = "week" | "month" | "last-month" | "custom";

function rangeFor(key: Exclude<RangeKey, "custom">) {
  const today = new Date();
  if (key === "week") {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: localISODate(monday), to: localISODate(sunday) };
  }
  const offset = key === "month" ? 0 : -1;
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const last = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  return { from: localISODate(first), to: localISODate(last) };
}

const RANGE_LABELS: Record<RangeKey, string> = {
  week: "Esta semana",
  month: "Este mes",
  "last-month": "Mes anterior",
  custom: "Personalizado",
};

// Destino del proyecto creado desde el modal rápido.
type QuickTarget = { kind: "entry" } | { kind: "row"; activityId: string };

export default function ActivitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [range, setRange] = useState(() => rangeFor("week"));
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [loadedRange, setLoadedRange] = useState<typeof range | null>(null);
  const loading = loadedRange !== range;

  const [quickTarget, setQuickTarget] = useState<QuickTarget | null>(null);

  // Fila de captura
  const [entryDate, setEntryDate] = useState(localISODate());
  const [entryProject, setEntryProject] = useState<string | null>(null);
  const [entryDescription, setEntryDescription] = useState("");
  const [entryHours, setEntryHours] = useState("");
  const descriptionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("projects").select("*").order("name").then(({ data, error }) => {
      if (error) setError(error.message);
      setProjects((data ?? []).map(toProject));
    });
  }, [supabase]);

  useEffect(() => {
    supabase
      .from("activities")
      .select("*")
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setActivities((data ?? []).map(toActivity));
        setLoadedRange(range);
      });
  }, [supabase, range]);

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const visible = useMemo(
    () => activities.filter((a) => !projectFilter || a.project_id === projectFilter),
    [activities, projectFilter],
  );

  const summary = useMemo(() => {
    const byProject = new Map<string, { project: Project | null; hours: number }>();
    for (const a of visible) {
      const key = a.project_id ?? "none";
      const entry = byProject.get(key) ?? { project: a.project_id ? projectsById[a.project_id] ?? null : null, hours: 0 };
      entry.hours += a.hours;
      byProject.set(key, entry);
    }
    const rows = [...byProject.values()].sort((a, b) => b.hours - a.hours);
    const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
    const totalsByCurrency: Record<string, number> = {};
    for (const r of rows) {
      if (!r.project) continue;
      totalsByCurrency[r.project.currency] = (totalsByCurrency[r.project.currency] ?? 0) + r.hours * r.project.hourly_rate;
    }
    return { rows, totalHours, totalsByCurrency };
  }, [visible, projectsById]);

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!entryDescription.trim() && !entryHours) return;
    const { data, error } = await supabase
      .from("activities")
      .insert({
        date: entryDate,
        project_id: entryProject,
        description: entryDescription.trim(),
        hours: Number(entryHours) || 0,
      })
      .select()
      .single();
    if (error) return setError(error.message);
    setError(null);
    if (data.date >= range.from && data.date <= range.to) {
      setActivities((prev) => sortActivities([toActivity(data), ...prev]));
    }
    // Mantiene fecha y proyecto para capturar varias actividades seguidas.
    setEntryDescription("");
    setEntryHours("");
    descriptionRef.current?.focus();
  }

  const updateActivity = useCallback(async (id: string, patch: Partial<Activity>) => {
    let previous: Activity | undefined;
    setActivities((prev) => sortActivities(prev.map((a) => {
      if (a.id !== id) return a;
      previous = a;
      return { ...a, ...patch };
    })));
    const { error } = await supabase.from("activities").update(patch).eq("id", id);
    if (error) {
      setError(error.message);
      if (previous) setActivities((prev) => sortActivities(prev.map((a) => (a.id === id ? previous! : a))));
    }
  }, [supabase]);

  async function deleteActivity(id: string) {
    const prev = activities;
    setActivities((list) => list.filter((a) => a.id !== id));
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setActivities(prev);
    }
  }

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)));
    if (quickTarget?.kind === "entry") setEntryProject(project.id);
    if (quickTarget?.kind === "row") updateActivity(quickTarget.activityId, { project_id: project.id });
    setQuickTarget(null);
  }

  function selectRange(key: RangeKey) {
    setRangeKey(key);
    if (key !== "custom") setRange(rangeFor(key));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-semibold tracking-tight">Actividades</h1>
          <button className="btn-ghost border border-slate-200 bg-white" onClick={() => setQuickTarget({ kind: "entry" })}>
            + Proyecto rápido
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <button key={key} onClick={() => selectRange(key)}
                className={`rounded px-2.5 py-1 text-sm transition ${rangeKey === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
          {rangeKey === "custom" && (
            <div className="flex items-center gap-1 text-sm">
              <input type="date" className="input w-auto" value={range.from}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
              <span className="text-slate-400">→</span>
              <input type="date" className="input w-auto" value={range.to}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          )}
          <select className="input ml-auto w-auto" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error} <button className="ml-2 underline" onClick={() => setError(null)}>cerrar</button>
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-36 px-3 py-2 font-medium">Fecha</th>
                <th className="w-52 px-3 py-2 font-medium">Proyecto</th>
                <th className="px-3 py-2 font-medium">Actividad</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Horas</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Monto</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {/* Fila de captura rápida */}
              <tr className="border-b border-slate-200 bg-indigo-50/40">
                <td className="px-2 py-2">
                  <input form="entry" type="date" required className="input" value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)} />
                </td>
                <td className="px-2 py-2">
                  <ProjectSelect projects={projects} value={entryProject} onChange={setEntryProject}
                    onCreateNew={() => setQuickTarget({ kind: "entry" })} />
                </td>
                <td className="px-2 py-2">
                  <input form="entry" ref={descriptionRef} className="input" placeholder="¿Qué hiciste?"
                    value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} />
                </td>
                <td className="px-2 py-2">
                  <input form="entry" type="number" min="0" step="0.25" className="input text-right" placeholder="0"
                    value={entryHours} onChange={(e) => setEntryHours(e.target.value)} />
                </td>
                <td className="px-2 py-2 text-right text-slate-400">
                  {entryProject && entryHours
                    ? formatMoney(Number(entryHours) * projectsById[entryProject].hourly_rate, projectsById[entryProject].currency)
                    : "—"}
                </td>
                <td className="px-2 py-2">
                  <form id="entry" onSubmit={addActivity}>
                    <button className="btn-primary px-2" aria-label="Agregar actividad" title="Agregar (Enter)">+</button>
                  </form>
                </td>
              </tr>

              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Sin actividades en este periodo.</td></tr>
              ) : (
                visible.map((a) => (
                  <ActivityRow
                    // Remonta la fila si cambian los valores guardados (p. ej. rollback por error).
                    key={`${a.id}:${a.description}:${a.hours}`}
                    activity={a}
                    projects={projects}
                    project={a.project_id ? projectsById[a.project_id] : undefined}
                    onUpdate={updateActivity}
                    onDelete={deleteActivity}
                    onCreateProject={() => setQuickTarget({ kind: "row", activityId: a.id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <h2 className="text-sm font-semibold text-slate-700">Resumen del periodo</h2>
        <p className="text-xs text-slate-500">{range.from} → {range.to}</p>
        <div className="mt-4 space-y-3">
          {summary.rows.length === 0 && <p className="text-sm text-slate-500">Nada registrado aún.</p>}
          {summary.rows.map(({ project, hours }) => (
            <div key={project?.id ?? "none"} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project?.color ?? "#cbd5e1" }} />
              <span className="min-w-0 flex-1 truncate">{project?.name ?? "Sin proyecto"}</span>
              <span className="text-right">
                <span className="block font-medium">{formatHours(hours)}</span>
                {project && (
                  <span className="block text-xs text-slate-500">{formatMoney(hours * project.hourly_rate, project.currency)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total horas</span>
            <span>{formatHours(summary.totalHours)}</span>
          </div>
          {Object.entries(summary.totalsByCurrency).map(([currency, amount]) => (
            <div key={currency} className="mt-1 flex justify-between font-semibold">
              <span>Total {currency}</span>
              <span>{formatMoney(amount, currency)}</span>
            </div>
          ))}
        </div>
      </aside>

      {quickTarget && (
        <Modal title="Nuevo proyecto rápido" onClose={() => setQuickTarget(null)}>
          <ProjectForm quick onSaved={handleProjectCreated} onCancel={() => setQuickTarget(null)} />
        </Modal>
      )}
    </div>
  );
}

function sortActivities(list: Activity[]) {
  return [...list].sort((a, b) =>
    a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date),
  );
}

function ActivityRow({ activity, project, projects, onUpdate, onDelete, onCreateProject }: {
  activity: Activity;
  project: Project | undefined;
  projects: Project[];
  onUpdate: (id: string, patch: Partial<Activity>) => void;
  onDelete: (id: string) => void;
  onCreateProject: () => void;
}) {
  const [description, setDescription] = useState(activity.description);
  const [hours, setHours] = useState(String(activity.hours));

  const cell = "input border-transparent bg-transparent hover:border-slate-200 focus:bg-white";

  return (
    <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
      <td className="px-2 py-1">
        <input type="date" className={cell} value={activity.date}
          onChange={(e) => e.target.value && onUpdate(activity.id, { date: e.target.value })} />
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project?.color ?? "#cbd5e1" }} />
          <ProjectSelect projects={projects} value={activity.project_id} className={cell}
            onChange={(project_id) => onUpdate(activity.id, { project_id })} onCreateNew={onCreateProject} />
        </div>
      </td>
      <td className="px-2 py-1">
        <input className={cell} value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== activity.description && onUpdate(activity.id, { description })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      </td>
      <td className="px-2 py-1">
        <input type="number" min="0" step="0.25" className={`${cell} text-right`} value={hours}
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => {
            const value = Number(hours) || 0;
            if (value !== activity.hours) onUpdate(activity.id, { hours: value });
            else setHours(String(activity.hours));
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      </td>
      <td className="px-3 py-1 text-right text-slate-600">
        {project ? formatMoney(activity.hours * project.hourly_rate, project.currency) : "—"}
      </td>
      <td className="px-2 py-1 text-center">
        <button className="rounded p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
          aria-label="Eliminar actividad"
          onClick={() => confirm("¿Eliminar esta actividad?") && onDelete(activity.id)}>
          ✕
        </button>
      </td>
    </tr>
  );
}
