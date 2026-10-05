"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { ProjectForm } from "@/components/ProjectForm";
import {
  STATUS_LABELS, formatHours, formatMoney, toProject, type Project,
} from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [hoursByProject, setHoursByProject] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("activities").select("project_id, hours"),
    ]).then(([p, a]) => {
      setProjects((p.data ?? []).map(toProject));
      const totals: Record<string, number> = {};
      for (const row of a.data ?? []) {
        if (row.project_id) totals[row.project_id] = (totals[row.project_id] ?? 0) + Number(row.hours);
      }
      setHoursByProject(totals);
      setLoading(false);
    });
  }, []);

  const visible = useMemo(
    () => projects.filter((p) => showArchived || p.status !== "archived"),
    [projects, showArchived],
  );

  function handleSaved(saved: Project) {
    setProjects((prev) =>
      prev.some((p) => p.id === saved.id)
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...prev],
    );
    setEditing(null);
  }

  async function handleDelete(project: Project) {
    if (!confirm(`¿Eliminar "${project.name}"? Sus actividades quedarán sin proyecto.`)) return;
    const { error } = await createClient().from("projects").delete().eq("id", project.id);
    if (error) return alert(error.message);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar archivados
        </label>
        <button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo proyecto</button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aún no tienes proyectos. Crea el primero para empezar a registrar horas.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => {
            const hours = hoursByProject[p.id] ?? 0;
            const budgetPct = p.budget_hours ? Math.min(100, (hours / p.budget_hours) * 100) : null;
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <p className="text-sm text-slate-500">{p.client || "Sin cliente"}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Tarifa</dt>
                    <dd className="font-medium">{formatMoney(p.hourly_rate, p.currency)}/h</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Horas</dt>
                    <dd className="font-medium">{formatHours(hours)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Total</dt>
                    <dd className="font-medium">{formatMoney(hours * p.hourly_rate, p.currency)}</dd>
                  </div>
                </dl>
                {budgetPct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${budgetPct}%`, backgroundColor: p.color }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatHours(hours)} de {formatHours(p.budget_hours!)} presupuestadas
                    </p>
                  </div>
                )}
                {p.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.notes}</p>}
                <div className="mt-4 flex justify-end gap-1">
                  <button className="btn-ghost text-red-600" onClick={() => handleDelete(p)}>Eliminar</button>
                  <button className="btn-ghost" onClick={() => setEditing(p)}>Editar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Nuevo proyecto" : "Editar proyecto"} onClose={() => setEditing(null)}>
          <ProjectForm
            project={editing === "new" ? undefined : editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
