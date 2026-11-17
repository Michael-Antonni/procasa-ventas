"use client";

import { ArrowRight, Building2, FolderOpen, LayoutGrid, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useData } from "@/components/data-provider";
import { GridSkeleton, SectionTitle } from "@/components/page-bits";
import { ProjectCard, ProjectFormDialog } from "@/components/project-ui";
import { ResourceList } from "@/components/resource-list";
import { BrandLogo } from "@/components/brand-logo";
import { Button, EmptyState } from "@/components/ui";
import { APP_NAME } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 sm:p-5">
      <div className="flex items-center gap-2 text-stone-500">
        {icon}
        <span className="truncate text-[13px] font-medium">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { profile, isAdmin, projects, resources, typologies, loading, now, lastSync } = useData();
  const [creating, setCreating] = useState(false);

  const latest = useMemo(
    () => [...resources].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8),
    [resources],
  );
  const quick = useMemo(
    () => [...projects].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at)).slice(0, 6),
    [projects],
  );
  const weekCount = useMemo(
    () => resources.filter((r) => now - new Date(r.updated_at).getTime() < 7 * 86_400_000).length,
    [resources, now],
  );

  const firstName = profile.is_shared ? "" : (profile.full_name || "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {firstName ? `Hola, ${firstName}` : APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Todo el material de los proyectos en su versión vigente.
          {lastSync && ` Sincronizado ${timeAgo(new Date(lastSync).toISOString(), now)}.`}
        </p>
        </div>
        <BrandLogo className="h-12 w-auto self-start sm:self-auto" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={<Building2 className="size-4" />} label="Proyectos" value={projects.length} />
        <Stat icon={<FolderOpen className="size-4" />} label="Materiales" value={resources.length} />
        <Stat icon={<LayoutGrid className="size-4" />} label="Tipologías" value={typologies.length} />
        <Stat
          icon={<Sparkles className="size-4" />}
          label="Actualizados"
          value={weekCount}
          hint="en los últimos 7 días"
        />
      </div>

      {loading && !projects.length ? (
        <GridSkeleton tall />
      ) : !projects.length ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="Aún no hay proyectos"
          text={
            isAdmin
              ? "Crea el primer proyecto para empezar a organizar su material comercial."
              : "Cuando el administrador publique proyectos, aparecerán aquí."
          }
          action={
            isAdmin && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Crear proyecto
              </Button>
            )
          }
        />
      ) : (
        <>
          <section>
            <SectionTitle
              aside={
                <Link
                  href="/proyectos"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
                >
                  Ver todos <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              Proyectos
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {quick.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Últimos archivos actualizados</SectionTitle>
            {latest.length ? (
              <ResourceList resources={latest} view="list" showProject />
            ) : (
              <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/80">
                Todavía no se ha subido material.
              </p>
            )}
          </section>
        </>
      )}

      {creating && <ProjectFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
