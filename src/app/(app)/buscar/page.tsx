"use client";

import { Building2, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { useViewMode } from "@/components/library-tab";
import { PageHeader, SectionTitle } from "@/components/page-bits";
import { ProjectCard } from "@/components/project-ui";
import { ResourceList, ViewToggle } from "@/components/resource-list";
import { Button, EmptyState, inputClass } from "@/components/ui";
import { CATEGORIES, CATEGORY_TREE, FILE_TYPES } from "@/lib/constants";
import { plural } from "@/lib/format";
import { search } from "@/lib/search";
import type { CategoryKey } from "@/lib/types";

const PAGE = 60;

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const data = useData();
  const [view, setView] = useViewMode();

  const q = params.get("q") ?? "";
  const projectId = params.get("proyecto") ?? "";
  const category = (params.get("categoria") ?? "") as CategoryKey | "";
  const fileType = params.get("tipo") ?? "";
  const key = `${q}|${projectId}|${category}|${fileType}`;
  const [shown, setShown] = useState({ key, limit: PAGE });
  const limit = shown.key === key ? shown.limit : PAGE;

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/buscar${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const results = useMemo(
    () => search(q, data, { projectId, category, fileType }),
    [q, data, projectId, category, fileType],
  );

  const hasFilters = Boolean(projectId || category || fileType);
  const total = results.projects.length + results.typologies.length + results.resources.length;
  const sortedProjects = useMemo(
    () => [...data.projects].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [data.projects],
  );

  return (
    <>
      <PageHeader
        title={q ? `Resultados para “${q}”` : "Buscar material"}
        subtitle={
          q || hasFilters
            ? plural(total, "resultado", "resultados")
            : "Escribe en el buscador o usa los filtros. Abajo tienes todo el material, del más reciente al más antiguo."
        }
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-[repeat(3,minmax(0,14rem))_auto] sm:items-center">
        <select
          aria-label="Filtrar por proyecto"
          className={inputClass}
          value={projectId}
          onChange={(e) => setParam("proyecto", e.target.value)}
        >
          <option value="">Todos los proyectos</option>
          {sortedProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por categoría"
          className={inputClass}
          value={category}
          onChange={(e) => setParam("categoria", e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {CATEGORY_TREE.groups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </optgroup>
          ))}
          {CATEGORIES.filter(
            (c) =>
              !CATEGORY_TREE.groups.some((group) => group.categories.some((category) => category.key === c.key)),
          ).map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo de archivo"
          className={inputClass}
          value={fileType}
          onChange={(e) => setParam("tipo", e.target.value)}
        >
          <option value="">Todos los tipos de archivo</option>
          {FILE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="size-4" />}
            onClick={() => router.replace(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar", { scroll: false })}
          >
            Quitar filtros
          </Button>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title={data.loading ? "Cargando…" : "No se encontró nada"}
          text={data.loading ? undefined : "Revisa la ortografía, usa menos palabras o quita algún filtro."}
        />
      ) : (
        <div className="space-y-8">
          {results.projects.length > 0 && (
            <section>
              <SectionTitle>Proyectos</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {results.projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}

          {results.typologies.length > 0 && (
            <section>
              <SectionTitle>Tipologías</SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.typologies.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/proyectos/${t.project_id}?tab=tipologias&tipologia=${t.id}`}
                      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/80 transition hover:shadow-md hover:ring-stone-300"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <Building2 className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-stone-900">{t.name}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {[
                            data.projectById.get(t.project_id)?.name,
                            t.area_m2 != null ? `${t.area_m2} m²` : null,
                            t.bedrooms != null ? `${t.bedrooms} dorm.` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.resources.length > 0 && (
            <section>
              <SectionTitle aside={<ViewToggle view={view} onChange={setView} />}>
                Materiales <span className="ml-1 font-normal text-stone-400">{results.resources.length}</span>
              </SectionTitle>
              <ResourceList resources={results.resources.slice(0, limit)} view={view} showProject />
              {results.resources.length > limit && (
                <div className="mt-5 flex justify-center">
                  <Button onClick={() => setShown({ key, limit: limit + PAGE })}>
                    Mostrar más ({results.resources.length - limit} restantes)
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
