"use client";

import type { Project } from "@/lib/types";

export const NEW_PROJECT = "__new__";

type Props = {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  onCreateNew: () => void;
  className?: string;
  id?: string;
};

export function ProjectSelect({ projects, value, onChange, onCreateNew, className, id }: Props) {
  // Los archivados solo se muestran si son el valor actual de la fila.
  const options = projects.filter((p) => p.status !== "archived" || p.id === value);

  return (
    <select
      id={id}
      className={className ?? "input"}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === NEW_PROJECT) return onCreateNew();
        onChange(e.target.value || null);
      }}
    >
      <option value="">— Sin proyecto —</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
      <option value={NEW_PROJECT}>+ Nuevo proyecto…</option>
    </select>
  );
}
