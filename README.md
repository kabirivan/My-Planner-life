# My Planner Life

Planner personal para registrar horas por proyecto. Next.js 16 + Bun + Supabase.

## Puesta en marcha

1. Ejecuta `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase.
2. Copia `.env.example` a `.env.local` y rellena la URL y la publishable key.
3. `bun install && bun dev`

## Vistas

- **/actividades**: tabla única con fecha, proyecto (editable), actividad (texto libre), horas y monto.
  Fila superior para captura rápida; opción "+ Nuevo proyecto…" en cualquier selector de proyecto.
  Resumen por proyecto del periodo (semana, mes, mes anterior o rango personalizado).
- **/proyectos**: alta y edición completa (nombre, cliente, tarifa/hora, moneda, color, estado,
  horas presupuestadas, notas) con horas y monto acumulados.
