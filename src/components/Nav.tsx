import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  if (!data?.claims) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/actividades" className="font-semibold tracking-tight">
          My Planner Life
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link href="/actividades" className="btn-ghost">Actividades</Link>
          <Link href="/proyectos" className="btn-ghost">Proyectos</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          <span className="hidden sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost">Salir</button>
          </form>
        </div>
      </div>
    </header>
  );
}
