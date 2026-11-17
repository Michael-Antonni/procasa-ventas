"use client";

import { FolderOpen, Plus, Search } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CATEGORIES, CATEGORY_TREE, CATEGORY_LABEL } from "@/lib/constants";
import { normalize } from "@/lib/format";
import type { CategoryKey, Project, Resource } from "@/lib/types";
import { useData } from "./data-provider";
import { UploadDialog } from "./resource-dialogs";
import { ResourceList, ViewToggle, type ViewMode } from "./resource-list";
import { Button, cx, EmptyState } from "./ui";

/** Preferencia de vista (galería o lista), recordada en este dispositivo. */
const viewListeners = new Set<() => void>();

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readView(): ViewMode {
  try {
    return localStorage.getItem("vista") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function writeView(view: ViewMode) {
  try {
    localStorage.setItem("vista", view);
  } catch {}
  viewListeners.forEach((listener) => listener());
}

export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const view = useSyncExternalStore<ViewMode>(subscribeView, readView, () => "grid");
  return [view, writeView];
}

const byRecent = (a: Resource, b: Resource) => b.updated_at.localeCompare(a.updated_at);
const DEPARTMENT_CATEGORY_KEYS: CategoryKey[] = CATEGORY_TREE.groups.flatMap((group) =>
  group.categories.map((category) => category.key),
);

export function LibraryTab({
  project,
  resources,
  category,
  onCategory,
}: {
  project: Project;
  resources: Resource[];
  category: string;
  onCategory: (c: string) => void;
}) {
  const { isAdmin } = useData();
  const [view, setView] = useViewMode();
  const [filter, setFilter] = useState("");
  const [uploadTo, setUploadTo] = useState<CategoryKey | null>(null);

  const activeCategory = CATEGORIES.find((c) => c.key === category);
  const activeGroup = CATEGORY_TREE.groups.find((group) => group.key === category);
  const activeRoot = category === CATEGORY_TREE.key;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + 1));
    return map;
  }, [resources]);

  const filtered = useMemo(() => {
    const tokens = normalize(filter).split(/\s+/).filter(Boolean);
    return resources
      .filter(
        (r) => {
          if (activeCategory) return r.category === activeCategory.key;
          if (activeGroup) return activeGroup.categories.some((c) => c.key === r.category);
          if (activeRoot) return DEPARTMENT_CATEGORY_KEYS.includes(r.category);
          return true;
        },
      )
      .filter((r) => {
        if (!tokens.length) return true;
        const text = normalize(`${r.name} ${r.file_name ?? ""} ${r.extension ?? ""} ${CATEGORY_LABEL[r.category]}`);
        return tokens.every((t) => text.includes(t));
      })
      .sort(byRecent);
  }, [resources, activeCategory, activeGroup, activeRoot, filter]);

  // En "Todo", el material se agrupa por categoría.
  const groups = useMemo(
    () =>
      activeCategory || activeGroup || activeRoot
        ? []
        : CATEGORIES.map((c) => ({ ...c, items: filtered.filter((r) => r.category === c.key) })).filter(
            (g) => g.items.length,
          ),
    [activeCategory, activeGroup, activeRoot, filtered],
  );
  const departmentGroups = CATEGORY_TREE.groups
    .map((group) => ({
      ...group,
      items: groups.filter((item) => group.categories.some((c) => c.key === item.key)),
    }))
    .filter((group) => group.items.length);

  const navItem = (key: string, label: string, count: number) => {
    const selected = category === key;
    return (
      <button
        key={key || "all"}
        type="button"
        onClick={() => onCategory(key)}
        aria-current={selected ? "true" : undefined}
        className={cx(
          "flex shrink-0 items-center justify-between gap-2 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors lg:w-full lg:rounded-lg lg:px-3 lg:py-2 lg:text-sm",
          selected
            ? "bg-stone-900 font-medium text-white lg:bg-brand-50 lg:text-brand-800"
            : cx(
                "bg-white ring-1 ring-stone-200 ring-inset hover:bg-stone-50 lg:bg-transparent lg:ring-0 lg:hover:bg-stone-100",
                count ? "text-stone-700" : "text-stone-400",
              ),
        )}
      >
        <span className="truncate">{label}</span>
        <span className={cx("text-xs tabular-nums", selected ? "opacity-70" : "text-stone-400")}>{count}</span>
      </button>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <nav
        aria-label="Categorías"
        className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:sticky lg:top-20 lg:mb-0 lg:block lg:space-y-0.5 lg:self-start lg:overflow-visible"
      >
        {navItem("", "Todo el material", resources.length)}
        {navItem(
          CATEGORY_TREE.key,
          CATEGORY_TREE.label,
          DEPARTMENT_CATEGORY_KEYS.reduce((total, key) => total + (counts.get(key) ?? 0), 0),
        )}
        <div className="flex shrink-0 gap-2 lg:ml-3 lg:flex-col lg:gap-1">
          {CATEGORY_TREE.groups.map((group) => (
            <div key={group.key} className="flex shrink-0 flex-col gap-1">
              {navItem(
                group.key,
                group.label,
                group.categories.reduce((total, c) => total + (counts.get(c.key) ?? 0), 0),
              )}
              <div className="flex gap-2 lg:ml-3 lg:flex-col lg:gap-0.5 lg:border-l lg:border-stone-200 lg:pl-2">
                {group.categories.map((c) => navItem(c.key, c.label, counts.get(c.key) ?? 0))}
              </div>
            </div>
          ))}
        </div>
        {CATEGORIES.filter((c) => !DEPARTMENT_CATEGORY_KEYS.includes(c.key)).map((c) =>
          navItem(c.key, c.label, counts.get(c.key) ?? 0),
        )}
      </nav>

      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar en este proyecto"
              aria-label="Filtrar en este proyecto"
              className="h-9 w-full rounded-lg border-0 bg-white pr-3 pl-9 text-sm shadow-sm ring-1 ring-stone-200 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            {isAdmin && activeCategory && (
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setUploadTo(activeCategory.key)}>
                <span className="hidden sm:inline">Agregar aquí</span>
              </Button>
            )}
          </div>
        </div>

        {!filtered.length ? (
          <EmptyState
            icon={<FolderOpen className="size-6" />}
            title={
              filter
                ? "Ningún material coincide con el filtro"
                : activeCategory || activeGroup || activeRoot
                  ? `Sin material en ${
                      activeCategory?.label ?? activeGroup?.label ?? CATEGORY_TREE.label
                    }`
                  : "Este proyecto aún no tiene material"
            }
            text={
              filter
                ? "Prueba con otra palabra."
                : isAdmin
                  ? "Sube archivos para que el equipo comercial pueda usarlos."
                  : "Cuando el administrador suba archivos, aparecerán aquí automáticamente."
            }
            action={
              isAdmin &&
              !filter && (
                <Button
                  variant="primary"
                  icon={<Plus className="size-4" />}
                  onClick={() =>
                    setUploadTo(
                      activeCategory?.key ??
                        activeGroup?.categories[0]?.key ??
                        CATEGORY_TREE.groups[0].categories[0].key,
                    )
                  }
                >
                  Agregar material
                </Button>
              )
            }
          />
        ) : activeCategory || activeGroup || activeRoot ? (
          <ResourceList resources={filtered} view={view} />
        ) : (
          <div className="space-y-8">
            {departmentGroups.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => onCategory(CATEGORY_TREE.key)}
                    className="text-sm font-semibold text-stone-900 hover:text-brand-700 hover:underline"
                  >
                    {CATEGORY_TREE.label}
                  </button>
                  <span className="text-xs text-stone-400">
                    {departmentGroups.reduce(
                      (total, group) => total + group.items.reduce((n, item) => n + item.items.length, 0),
                      0,
                    )}
                  </span>
                </div>
                <div className="space-y-6">
                  {departmentGroups.map((group) => (
                    <div key={group.key}>
                      <div className="mb-2 flex items-baseline gap-2">
                        <button
                          type="button"
                          onClick={() => onCategory(group.key)}
                          className="text-sm font-medium text-stone-700 hover:text-brand-700 hover:underline"
                        >
                          {group.label}
                        </button>
                        <span className="text-xs text-stone-400">
                          {group.items.reduce((total, item) => total + item.items.length, 0)}
                        </span>
                      </div>
                      <div className="space-y-5 border-l border-stone-200 pl-3">
                        {group.items.map((item) => {
                          const categoryLabel = group.categories.find((c) => c.key === item.key)?.label ?? item.label;
                          return (
                            <div key={item.key}>
                              <div className="mb-2 flex items-baseline gap-2">
                                <button
                                  type="button"
                                  onClick={() => onCategory(item.key)}
                                  className="text-sm font-medium text-stone-600 hover:text-brand-700 hover:underline"
                                >
                                  {categoryLabel}
                                </button>
                                <span className="text-xs text-stone-400">{item.items.length}</span>
                              </div>
                              <ResourceList resources={item.items} view={view} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {groups.filter((g) => !DEPARTMENT_CATEGORY_KEYS.includes(g.key)).map((g) => (
              <section key={g.key}>
                <div className="mb-3 flex items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => onCategory(g.key)}
                    className="text-sm font-semibold text-stone-900 hover:text-brand-700 hover:underline"
                  >
                    {g.label}
                  </button>
                  <span className="text-xs text-stone-400">{g.items.length}</span>
                </div>
                <ResourceList resources={g.items} view={view} />
              </section>
            ))}
          </div>
        )}
      </div>

      {uploadTo && <UploadDialog project={project} defaultCategory={uploadTo} onClose={() => setUploadTo(null)} />}
    </div>
  );
}
