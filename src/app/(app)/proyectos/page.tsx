"use client";

import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { GridSkeleton, PageHeader } from "@/components/page-bits";
import { ProjectCard, ProjectFormDialog } from "@/components/project-ui";
import { Button, cx, EmptyState } from "@/components/ui";
import { STATUSES } from "@/lib/constants";
import { plural } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";

export default function ProjectsPage() {
  const { projects, isAdmin, loading } = useData();
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [creating, setCreating] = useState(false);

  const list = useMemo(
    () =>
      projects
        .filter((p) => !status || p.status === status)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [projects, status],
  );

  const chip = (key: ProjectStatus | "", label: string, count: number) => (
    <button
      key={key || "all"}
      type="button"
      onClick={() => setStatus(key)}
      aria-pressed={status === key}
      className={cx(
        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors ring-inset",
        status === key
          ? "bg-stone-900 text-white ring-stone-900"
          : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50",
      )}
    >
      {label} <span className={status === key ? "text-white/60" : "text-stone-400"}>{count}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        title="Proyectos"
        subtitle={plural(projects.length, "proyecto registrado", "proyectos registrados")}
        actions={
          isAdmin && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Nuevo proyecto
            </Button>
          )
        }
      />

      {projects.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {chip("", "Todos", projects.length)}
          {STATUSES.map((s) => chip(s.key, s.label, projects.filter((p) => p.status === s.key).length))}
        </div>
      )}

      {loading && !projects.length ? (
        <GridSkeleton tall />
      ) : list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={projects.length ? "No hay proyectos en este estado" : "Aún no hay proyectos"}
          text={
            projects.length
              ? "Prueba con otro filtro."
              : isAdmin
                ? "Crea el primer proyecto para empezar a organizar su material."
                : "Cuando el administrador publique proyectos, aparecerán aquí."
          }
        />
      )}

      {creating && (
        <ProjectFormDialog onClose={() => setCreating(false)} onSaved={(p) => router.push(`/proyectos/${p.id}`)} />
      )}
    </>
  );
}
