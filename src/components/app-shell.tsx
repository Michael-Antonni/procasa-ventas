"use client";

import {
  Building2,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Search,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { APP_NAME, CATEGORY_SHORT, STATUS_MAP } from "@/lib/constants";
import { formatLabel, timeAgo } from "@/lib/format";
import { search } from "@/lib/search";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { BrandLogo } from "./brand-logo";
import { DataProvider, useData } from "./data-provider";
import { ResourceThumb } from "./resource-thumb";
import { ToastProvider } from "./toast";
import { cx, IconButton } from "./ui";
import { useViewer, ViewerProvider } from "./viewer";

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider profile={profile}>
        <ViewerProvider>
          <Frame>{children}</Frame>
        </ViewerProvider>
      </DataProvider>
    </ToastProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { error, reload } = useData();
  // El menú móvil se cierra solo al cambiar de pantalla.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = (open: boolean) => setDrawerPath(open ? pathname : null);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-200 bg-white lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade absolute inset-0 bg-stone-900/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
            <Sidebar onClose={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-stone-200 bg-[#f8f7f5]/90 px-3 backdrop-blur sm:px-6">
        <IconButton label="Abrir menú" className="lg:hidden" onClick={() => setDrawer(true)}>
          <MenuIcon className="size-5" />
        </IconButton>
        <Suspense fallback={<div className="h-10 flex-1" />}>
          <GlobalSearch />
        </Suspense>
        <LiveIndicator />
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
          <span>{error}</span>
          <button type="button" onClick={reload} className="font-medium underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function LiveIndicator() {
  const { live, lastSync, now } = useData();
  const label = live === "live" ? "En vivo" : live === "connecting" ? "Conectando" : "Sin tiempo real";
  const title =
    live === "live"
      ? "Los cambios aparecen al instante."
      : live === "connecting"
        ? "Estableciendo conexión en tiempo real…"
        : "Sin conexión en tiempo real: la información se actualiza cada 30 segundos.";
  return (
    <div
      title={`${title}${lastSync ? ` Última sincronización: ${timeAgo(new Date(lastSync).toISOString(), now)}.` : ""}`}
      className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm ring-1 ring-stone-200"
    >
      <span className="relative flex size-2">
        {live === "live" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={cx(
            "relative inline-flex size-2 rounded-full",
            live === "live" ? "bg-emerald-500" : live === "connecting" ? "bg-amber-400" : "bg-stone-400",
          )}
        />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isAdmin, projects, now } = useData();

  const links = [
    { href: "/", label: "Panel", icon: LayoutDashboard, active: pathname === "/" },
    { href: "/proyectos", label: "Proyectos", icon: FolderOpen, active: pathname === "/proyectos" },
    { href: "/buscar", label: "Buscar material", icon: Search, active: pathname === "/buscar" },
    ...(isAdmin
      ? [
          { href: "/historial", label: "Historial", icon: History, active: pathname === "/historial" },
          { href: "/usuarios", label: "Usuarios", icon: Users, active: pathname === "/usuarios" },
        ]
      : []),
  ];

  const logout = async () => {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const sorted = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name, "es")), [projects]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] shrink-0 items-center gap-2.5 border-b border-stone-100 px-5">
        <div className="min-w-0 flex-1">
          <BrandLogo className="h-9 w-auto max-w-full" />
          <span className="mt-0.5 block truncate text-[10px] font-medium tracking-wide text-stone-500">
            {APP_NAME}
          </span>
        </div>
        {onClose && (
          <IconButton label="Cerrar menú" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        )}
      </div>

      <nav className="space-y-0.5 px-3 pt-1">
        {links.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>

      <p className="px-6 pt-6 pb-2 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Proyectos</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {sorted.map((p) => {
          const active = pathname === `/proyectos/${p.id}`;
          return (
            <Link
              key={p.id}
              href={`/proyectos/${p.id}`}
              title={`${p.name} · ${STATUS_MAP[p.status].label} · actualizado ${timeAgo(p.last_activity_at, now)}`}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active ? "bg-brand-50 font-medium text-brand-800" : "text-stone-600 hover:bg-stone-100",
              )}
            >
              <span className={cx("size-1.5 shrink-0 rounded-full", active ? "bg-brand-600" : "bg-stone-300")} />
              <span className="truncate">{p.name}</span>
            </Link>
          );
        })}
        {!sorted.length && <p className="px-3 py-1.5 text-sm text-stone-400">Aún no hay proyectos.</p>}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-stone-200 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600 uppercase">
          {(profile.full_name || profile.email).slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900">{profile.full_name || profile.email}</p>
          <p className="truncate text-xs text-stone-500">
            {isAdmin ? "Administrador" : profile.is_shared ? "Equipo comercial · cuenta compartida" : "Asesor comercial"}
          </p>
        </div>
        <IconButton label="Cerrar sesión" onClick={logout}>
          <LogOut className="size-[18px]" />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * Buscador único de la aplicación. Muestra resultados al instante y, con
 * Enter, abre la pantalla de búsqueda completa con filtros.
 */
function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const data = useData();
  const viewer = useViewer();
  const onSearchPage = pathname === "/buscar";
  const urlQuery = onSearchPage ? (params.get("q") ?? "") : "";
  const [text, setText] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // En la pantalla de búsqueda, el cuadro refleja lo que dice la URL.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== text.trim()) setText(urlQuery);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const results = useMemo(() => {
    if (onSearchPage || !open || text.trim().length < 2) return null;
    const r = search(text, data);
    return {
      projects: r.projects.slice(0, 3),
      typologies: r.typologies.slice(0, 3),
      resources: r.resources.slice(0, 6),
      total: r.projects.length + r.typologies.length + r.resources.length,
    };
  }, [text, open, onSearchPage, data]);

  const goToSearch = (q: string) => {
    const next = new URLSearchParams(onSearchPage ? params.toString() : "");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    const url = `/buscar${next.size ? `?${next}` : ""}`;
    if (onSearchPage) router.replace(url, { scroll: false });
    else router.push(url);
  };

  const onChange = (value: string) => {
    setText(value);
    setOpen(true);
    if (onSearchPage) goToSearch(value);
  };

  const itemClass = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-stone-100";
  const groupClass = "px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-stone-400 uppercase";

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 lg:max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          goToSearch(text);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-stone-400" />
        <input
          ref={inputRef}
          type="search"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Buscar proyectos, renders, planos, brochures…"
          aria-label="Buscar"
          className="h-10 w-full rounded-full border-0 bg-white pr-4 pl-10 text-sm text-stone-900 shadow-sm ring-1 ring-stone-200 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      {results && (
        <div className="animate-pop absolute inset-x-0 top-full z-40 mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-stone-200">
          {results.total === 0 && (
            <p className="px-3 py-6 text-center text-sm text-stone-500">Sin resultados para “{text.trim()}”.</p>
          )}
          {results.projects.length > 0 && <p className={groupClass}>Proyectos</p>}
          {results.projects.map((p) => (
            <Link key={p.id} href={`/proyectos/${p.id}`} onClick={() => setOpen(false)} className={itemClass}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Building2 className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">{p.name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {[STATUS_MAP[p.status].label, p.location].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          ))}
          {results.typologies.length > 0 && <p className={groupClass}>Tipologías</p>}
          {results.typologies.map((t) => (
            <Link
              key={t.id}
              href={`/proyectos/${t.project_id}?tab=tipologias&tipologia=${t.id}`}
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-semibold text-stone-600">
                {t.bedrooms != null ? `${t.bedrooms}D` : "T"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">{t.name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {[data.projectById.get(t.project_id)?.name, t.area_m2 != null ? `${t.area_m2} m²` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          ))}
          {results.resources.length > 0 && <p className={groupClass}>Materiales</p>}
          {results.resources.map((r) => (
            <button
              key={r.id}
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                viewer.open(
                  results.resources.map((x) => x.id),
                  r.id,
                );
              }}
            >
              <ResourceThumb resource={r} compact className="size-9 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">{r.name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {[data.projectById.get(r.project_id)?.name, CATEGORY_SHORT[r.category], formatLabel(r)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
          {results.total > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                goToSearch(text);
              }}
              className="mt-1 w-full rounded-lg border-t border-stone-100 px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Ver los {results.total} resultados y filtrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}
