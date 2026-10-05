"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCIES, PROJECT_COLORS, STATUS_LABELS, toProject,
  type Project, type ProjectStatus,
} from "@/lib/types";

type Props = {
  project?: Project;
  /** Modo rápido: solo nombre, tarifa, moneda y color. */
  quick?: boolean;
  defaultName?: string;
  onSaved: (project: Project) => void;
  onCancel: () => void;
};

export function ProjectForm({ project, quick, defaultName, onSaved, onCancel }: Props) {
  const [name, setName] = useState(project?.name ?? defaultName ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [rate, setRate] = useState(String(project?.hourly_rate ?? ""));
  const [currency, setCurrency] = useState(project?.currency ?? "USD");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [budget, setBudget] = useState(project?.budget_hours == null ? "" : String(project.budget_hours));
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const values = {
      name: name.trim(),
      client: client.trim() || null,
      hourly_rate: Number(rate) || 0,
      currency,
      color,
      status,
      budget_hours: budget === "" ? null : Number(budget),
      notes: notes.trim() || null,
    };

    const supabase = createClient();
    const query = project
      ? supabase.from("projects").update(values).eq("id", project.id)
      : supabase.from("projects").insert(values);
    const { data, error } = await query.select().single();

    setSaving(false);
    if (error) return setError(error.message);
    onSaved(toProject(data));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-name">Nombre del proyecto</label>
          <input id="p-name" className="input" required autoFocus value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-rate">Precio por hora</label>
          <input id="p-rate" type="number" min="0" step="0.01" className="input" value={rate}
            onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="p-currency">Moneda</label>
          <select id="p-currency" className="input" value={currency}
            onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {!quick && (
          <>
            <div>
              <label className="label" htmlFor="p-client">Cliente</label>
              <input id="p-client" className="input" value={client}
                onChange={(e) => setClient(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="p-status">Estado</label>
              <select id="p-status" className="input" value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-budget">Horas presupuestadas</label>
              <input id="p-budget" type="number" min="0" step="0.5" className="input" value={budget}
                onChange={(e) => setBudget(e.target.value)} placeholder="Opcional" />
            </div>
          </>
        )}
        <div className={quick ? "sm:col-span-2" : ""}>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2 pt-1">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full ring-offset-2 transition ${color === c ? "ring-2 ring-slate-900" : ""}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        {!quick && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-notes">Notas</label>
            <textarea id="p-notes" rows={3} className="input" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Guardando..." : project ? "Guardar cambios" : "Crear proyecto"}
        </button>
      </div>
    </form>
  );
}
