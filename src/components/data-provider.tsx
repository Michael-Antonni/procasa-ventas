"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ensureRealtimeAuth, getSupabase } from "@/lib/supabase/client";
import type { Profile, Project, Resource, Typology } from "@/lib/types";
import { useToast } from "./toast";

type Table = "projects" | "typologies" | "resources";
type Row = Project | Typology | Resource;

interface State {
  projects: Project[];
  typologies: Typology[];
  resources: Resource[];
}

type Action =
  | { type: "set"; state: State }
  | { type: "upsert"; table: Table; row: Row }
  | { type: "remove"; table: Table; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return action.state;
    case "upsert": {
      const list = state[action.table] as Row[];
      const exists = list.some((r) => r.id === action.row.id);
      const next = exists ? list.map((r) => (r.id === action.row.id ? action.row : r)) : [...list, action.row];
      return { ...state, [action.table]: next };
    }
    case "remove": {
      if (action.table === "projects") {
        return {
          projects: state.projects.filter((p) => p.id !== action.id),
          typologies: state.typologies.filter((t) => t.project_id !== action.id),
          resources: state.resources.filter((r) => r.project_id !== action.id),
        };
      }
      if (action.table === "typologies") {
        return {
          ...state,
          typologies: state.typologies.filter((t) => t.id !== action.id),
          resources: state.resources.map((r) => (r.typology_id === action.id ? { ...r, typology_id: null } : r)),
        };
      }
      return { ...state, resources: state.resources.filter((r) => r.id !== action.id) };
    }
  }
}

export type LiveStatus = "connecting" | "live" | "offline";

interface DataContextValue extends State {
  profile: Profile;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  /** Estado de la conexión en tiempo real. */
  live: LiveStatus;
  /** Momento de la última sincronización con el servidor. */
  lastSync: number | null;
  /** Reloj que avanza cada minuto, para refrescar textos como "hace 5 min". */
  now: number;
  projectById: Map<string, Project>;
  typologyById: Map<string, Typology>;
  reload: () => Promise<void>;
  /** Aplica en pantalla un cambio hecho por este usuario, sin esperar al servidor. */
  upsert: (table: Table, row: Row) => void;
  remove: (table: Table, id: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de DataProvider");
  return ctx;
}

async function fetchAll<T>(table: Table, orderBy: string): Promise<T[]> {
  const supabase = getSupabase();
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

const EMPTY: State = { projects: [], typologies: [], resources: [] };

/** ¿Cambió algo que el equipo deba saber? (ignora sellos internos) */
function projectChanged(a: Project, b: Project): boolean {
  return (
    a.name !== b.name ||
    a.description !== b.description ||
    a.location !== b.location ||
    a.status !== b.status ||
    a.commercial_info !== b.commercial_info ||
    a.cover_path !== b.cover_path
  );
}

interface PendingNotice {
  projectId: string | null;
  projectName: string;
  text: string;
  gone?: boolean;
}

export function DataProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  const toast = useToast();
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cambios hechos en esta pestaña: no hace falta avisarle al propio autor.
  const localMarks = useRef(new Map<string, number>());
  const markLocal = useCallback((id: string) => {
    localMarks.current.set(id, Date.now());
  }, []);
  const isLocal = useCallback((id: string) => Date.now() - (localMarks.current.get(id) ?? 0) < 15_000, []);

  const reload = useCallback(async () => {
    try {
      const [projects, typologies, resources] = await Promise.all([
        fetchAll<Project>("projects", "name"),
        fetchAll<Typology>("typologies", "sort_order"),
        fetchAll<Resource>("resources", "created_at"),
      ]);
      dispatch({ type: "set", state: { projects, typologies, resources } });
      setError(null);
      setLastSync(Date.now());
    } catch {
      setError("No se pudo cargar la información. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Avisos agrupados: varias subidas seguidas generan un solo aviso por proyecto.
  const pending = useRef<PendingNotice[]>([]);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNotices = useCallback(() => {
    noticeTimer.current = null;
    const list = pending.current;
    pending.current = [];
    const groups = new Map<string, PendingNotice[]>();
    for (const n of list) {
      const key = n.projectId ?? "-";
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    for (const group of groups.values()) {
      const gone = group.find((n) => n.gone);
      const first = group[0];
      if (gone) {
        toast({ tone: "update", title: gone.text });
      } else if (group.length === 1) {
        toast({
          tone: "update",
          title: first.text,
          description: first.projectName,
          href: first.projectId ? `/proyectos/${first.projectId}` : undefined,
        });
      } else {
        toast({
          tone: "update",
          title: `${group.length} cambios en ${first.projectName}`,
          description: "El material ya está actualizado en tu pantalla.",
          href: first.projectId ? `/proyectos/${first.projectId}` : undefined,
        });
      }
    }
  }, [toast]);

  const notify = useCallback(
    (n: PendingNotice) => {
      pending.current.push(n);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(flushNotices, 1200);
    },
    [flushNotices],
  );

  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useCallback(
    (table: Table, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const current = stateRef.current;
      // Evento sin datos legibles (p. ej. sesión del canal vencida): se consulta al servidor.
      const unreadable =
        Boolean(payload.errors?.length) ||
        (payload.eventType !== "DELETE" && !(payload.new as { id?: string }).id);
      if (unreadable) {
        if (!resyncTimer.current) {
          resyncTimer.current = setTimeout(() => {
            resyncTimer.current = null;
            reload();
          }, 800);
        }
        return;
      }
      setLastSync(Date.now());

      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        const prev = (current[table] as Row[]).find((r) => r.id === id);
        dispatch({ type: "remove", table, id });
        if (!prev || isLocal(id)) return;
        if (table === "projects") {
          notify({ projectId: id, projectName: prev.name, text: `Proyecto retirado: ${prev.name}`, gone: true });
        } else {
          const projectId = (prev as Resource | Typology).project_id;
          const project = current.projects.find((p) => p.id === projectId);
          if (!project || isLocal(projectId)) return;
          notify({
            projectId,
            projectName: project.name,
            text: `${table === "resources" ? "Material retirado" : "Tipología retirada"}: ${prev.name}`,
          });
        }
        return;
      }

      const row = payload.new as unknown as Row;
      const prev = (current[table] as Row[]).find((r) => r.id === row.id);
      dispatch({ type: "upsert", table, row });
      if (isLocal(row.id)) return;

      if (table === "projects") {
        const project = row as Project;
        if (!prev) {
          notify({ projectId: project.id, projectName: project.name, text: "Nuevo proyecto disponible" });
        } else if (projectChanged(prev as Project, project)) {
          notify({ projectId: project.id, projectName: project.name, text: "Información del proyecto actualizada" });
        }
        return;
      }

      const item = row as Resource | Typology;
      // Sin cambio de fecha = ajuste automático (p. ej. se borró su tipología).
      if (prev && prev.updated_at === item.updated_at) return;
      const projectName = current.projects.find((p) => p.id === item.project_id)?.name ?? "Proyecto";
      let text: string;
      if (table === "typologies") {
        text = `${prev ? "Tipología actualizada" : "Nueva tipología"}: ${item.name}`;
      } else {
        const before = prev as Resource | undefined;
        const after = item as Resource;
        if (!before) text = `Nuevo material: ${after.name}`;
        else if (before.storage_path !== after.storage_path || before.external_url !== after.external_url)
          text = `Nueva versión disponible: ${after.name}`;
        else text = `Material actualizado: ${after.name}`;
      }
      notify({ projectId: item.project_id, projectName, text });
    },
    [notify, isLocal, reload],
  );

  // --- Conexión en tiempo real + cargas de respaldo.
  useEffect(() => {
    const supabase = getSupabase();
    let hiddenAt = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el servidor
    reload();

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    ensureRealtimeAuth()
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        channel = supabase
          .channel("biblioteca")
          .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (p) => onChange("projects", p))
          .on("postgres_changes", { event: "*", schema: "public", table: "typologies" }, (p) =>
            onChange("typologies", p),
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "resources" }, (p) =>
            onChange("resources", p),
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setLive("live");
              // Recupera cualquier cambio ocurrido mientras no había conexión.
              reload();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setLive("offline");
            }
          });
      });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) reload();
    };
    const onOnline = () => reload();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [reload, onChange]);

  // Sin tiempo real (red restrictiva, etc.) se consulta cada 30 segundos.
  useEffect(() => {
    if (live === "live") return;
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [live, reload]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const upsert = useCallback(
    (table: Table, row: Row) => {
      markLocal(row.id);
      dispatch({ type: "upsert", table, row });
    },
    [markLocal],
  );

  const remove = useCallback(
    (table: Table, id: string) => {
      markLocal(id);
      dispatch({ type: "remove", table, id });
    },
    [markLocal],
  );

  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);
  const typologyById = useMemo(() => new Map(state.typologies.map((t) => [t.id, t])), [state.typologies]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      profile,
      isAdmin: profile.role === "admin",
      loading,
      error,
      live,
      lastSync,
      now,
      projectById,
      typologyById,
      reload,
      upsert,
      remove,
    }),
    [state, profile, loading, error, live, lastSync, now, projectById, typologyById, reload, upsert, remove],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
