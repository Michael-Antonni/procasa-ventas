"use client";

import { History, Lock, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-bits";
import { Button, cx, EmptyState, ErrorNote, inputClass, Spinner } from "@/components/ui";
import { CATEGORIES, STATUSES } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ensureRealtimeAuth, getSupabase } from "@/lib/supabase/client";
import type { ActivityEntry } from "@/lib/types";

const PAGE = 50;

const LABELS: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])),
  ...Object.fromEntries(STATUSES.map((s) => [s.key, s.label])),
  admin: "Administrador",
  comercial: "Comercial",
};

const ACTIONS = {
  created: { verb: "agregó", label: "Agregados", icon: Plus, tone: "bg-emerald-50 text-emerald-700" },
  updated: { verb: "modificó", label: "Modificados", icon: Pencil, tone: "bg-sky-50 text-sky-700" },
  replaced: { verb: "reemplazó", label: "Reemplazados", icon: RefreshCw, tone: "bg-amber-50 text-amber-700" },
  deleted: { verb: "eliminó", label: "Eliminados", icon: Trash2, tone: "bg-red-50 text-red-700" },
} as const;

const ENTITY = {
  project: "el proyecto",
  typology: "la tipología",
  resource: "el archivo",
  user: "el usuario",
} as const;

/** El historial guarda claves internas (p. ej. "en_construccion"); aquí se muestran con su nombre. */
function readable(details: string): string {
  return details.replace(/[a-z]+(?:_[a-z]+)*/g, (word) => LABELS[word] ?? word);
}

export default function HistoryPage() {
  const { isAdmin, projects, projectById, now } = useData();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [action, setAction] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      let query = getSupabase()
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (action) query = query.eq("action", action);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error: loadError } = await query;
      if (id !== requestId.current) return;
      setLoading(false);
      if (loadError) return setError(errorMessage(loadError));
      const rows = (data ?? []) as ActivityEntry[];
      setError(null);
      setMore(rows.length === PAGE);
      setEntries((prev) => (offset ? [...prev, ...rows] : rows));
    },
    [action, projectId],
  );

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga desde el servidor
    load(0);
    // Los movimientos nuevos aparecen sin recargar la página.
    const supabase = getSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    ensureRealtimeAuth()
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        channel = supabase
          .channel("historial")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
            const row = payload.new as ActivityEntry;
            if (!row?.id) return void load(0);
            if (action && row.action !== action) return;
            if (projectId && row.project_id !== projectId) return;
            setEntries((prev) => (prev.some((e) => e.id === row.id) ? prev : [row, ...prev]));
          })
          .subscribe();
      });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAdmin, load, action, projectId]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Lock className="size-6" />}
        title="Sección solo para administradores"
        text="El historial de modificaciones está disponible únicamente para administradores."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Historial de modificaciones"
        subtitle="Qué se agregó, modificó, reemplazó o eliminó, cuándo y quién lo hizo."
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-[repeat(2,minmax(0,15rem))]">
        <select
          aria-label="Filtrar por acción"
          className={inputClass}
          value={action}
          onChange={(e) => {
            setLoading(true);
            setAction(e.target.value);
          }}
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTIONS).map(([key, a]) => (
            <option key={key} value={key}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por proyecto"
          className={inputClass}
          value={projectId}
          onChange={(e) => {
            setLoading(true);
            setProjectId(e.target.value);
          }}
        >
          <option value="">Todos los proyectos</option>
          {[...projects]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : !entries.length ? (
        <EmptyState
          icon={<History className="size-6" />}
          title="Sin movimientos"
          text="Aquí aparecerá cada cambio realizado en proyectos, tipologías y archivos."
        />
      ) : (
        <>
          <ul className="divide-y divide-stone-100 rounded-xl bg-white shadow-sm ring-1 ring-stone-200/80">
            {entries.map((e) => {
              const a = ACTIONS[e.action];
              const Icon = a.icon;
              const projectExists = e.project_id && projectById.has(e.project_id);
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className={cx("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", a.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-700">
                      <span className="font-medium text-stone-900">{e.user_name || "Sistema"}</span> {a.verb}{" "}
                      {ENTITY[e.entity_type]} <span className="font-medium text-stone-900">{e.entity_name}</span>
                      {e.entity_type !== "project" && e.project_name && (
                        <>
                          {" "}
                          en{" "}
                          {projectExists ? (
                            <Link href={`/proyectos/${e.project_id}`} className="font-medium text-brand-700 hover:underline">
                              {e.project_name}
                            </Link>
                          ) : (
                            <span className="font-medium">{e.project_name}</span>
                          )}
                        </>
                      )}
                    </p>
                    {e.details && <p className="mt-0.5 truncate text-xs text-stone-500">{readable(e.details)}</p>}
                  </div>
                  <time
                    dateTime={e.created_at}
                    title={timeAgo(e.created_at, now)}
                    className="shrink-0 pt-0.5 text-right text-xs text-stone-500"
                  >
                    {formatDateTime(e.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
          {more && (
            <div className="mt-5 flex justify-center">
              <Button onClick={() => load(entries.length)}>Cargar más</Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
