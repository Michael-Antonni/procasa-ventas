"use client";

import { ChevronRight, FolderOpen, MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { LibraryTab } from "@/components/library-tab";
import { ProjectCover, ProjectFormDialog, StatusBadge } from "@/components/project-ui";
import { UploadDialog } from "@/components/resource-dialogs";
import { useToast } from "@/components/toast";
import { TypologiesTab } from "@/components/typologies-tab";
import { Button, ConfirmDialog, cx, EmptyState, IconButton, Menu, MenuItem, Spinner } from "@/components/ui";
import { CATEGORIES, STATUS_MAP } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { removeObjects } from "@/lib/files";
import { formatDateTime, plural, timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Tab = "biblioteca" | "tipologias" | "informacion";

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectView />
    </Suspense>
  );
}

function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { projectById, resources, typologies, isAdmin, loading, now, remove } = useData();
  const project = projectById.get(id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "tipologias" || tabParam === "informacion" ? tabParam : "biblioteca";
  const category = params.get("cat") ?? "";
  const typologyId = params.get("tipologia") ?? "";

  /** Cambia parámetros de la URL sin perder la posición en la página. */
  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`/proyectos/${id}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [params, router, id],
  );

  const mine = useMemo(() => resources.filter((r) => r.project_id === id), [resources, id]);
  const myTypologies = useMemo(
    () =>
      typologies
        .filter((t) => t.project_id === id)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es")),
    [typologies, id],
  );

  if (!project) {
    if (loading) {
      return (
        <div className="flex justify-center py-24">
          <Spinner className="size-6" />
        </div>
      );
    }
    return (
      <EmptyState
        icon={<FolderOpen className="size-6" />}
        title="Este proyecto ya no está disponible"
        text="Puede que haya sido eliminado por un administrador."
        action={
          <Link href="/proyectos" className="text-sm font-medium text-brand-700 hover:underline">
            Ver todos los proyectos
          </Link>
        }
      />
    );
  }

  const confirmDelete = async () => {
    const paths = [project.cover_path, ...mine.flatMap((r) => [r.storage_path, r.thumb_path])];
    const { error } = await getSupabase().from("projects").delete().eq("id", project.id);
    if (error) throw new Error(errorMessage(error));
    remove("projects", project.id);
    await removeObjects(paths);
    toast({ title: "Proyecto eliminado" });
    router.replace("/proyectos");
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "biblioteca", label: "Biblioteca", count: mine.length },
    { key: "tipologias", label: "Tipologías", count: myTypologies.length },
    { key: "informacion", label: "Información" },
  ];

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1 text-[13px] text-stone-500">
        <Link href="/proyectos" className="hover:text-stone-900 hover:underline">
          Proyectos
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate font-medium text-stone-800">{project.name}</span>
      </nav>

      <header className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80 sm:flex">
        <ProjectCover project={project} className="aspect-[16/9] w-full sm:aspect-auto sm:w-64 sm:shrink-0 lg:w-80" />
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatusBadge status={project.status} />
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{project.name}</h1>
              {project.location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
                  <MapPin className="size-4 shrink-0" /> {project.location}
                </p>
              )}
            </div>
            {isAdmin && (
              <Menu
                trigger={(props) => (
                  <IconButton label="Opciones del proyecto" {...props}>
                    <MoreHorizontal className="size-5" />
                  </IconButton>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon={<Pencil className="size-4" />}
                      onClick={() => {
                        close();
                        setEditing(true);
                      }}
                    >
                      Editar proyecto
                    </MenuItem>
                    <MenuItem
                      danger
                      icon={<Trash2 className="size-4" />}
                      onClick={() => {
                        close();
                        setDeleting(true);
                      }}
                    >
                      Eliminar proyecto
                    </MenuItem>
                  </>
                )}
              </Menu>
            )}
          </div>
          {project.description && (
            <p className="mt-3 line-clamp-3 max-w-3xl text-sm text-stone-600">{project.description}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-xs text-stone-500" title={formatDateTime(project.last_activity_at)}>
              {plural(mine.length, "material", "materiales")} · Última actualización{" "}
              <span className="font-medium text-stone-700">{timeAgo(project.last_activity_at, now)}</span>
            </p>
            {isAdmin && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setUploading(true)}>
                Agregar material
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="no-scrollbar mt-6 mb-5 flex gap-6 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams({ tab: t.key === "biblioteca" ? null : t.key, tipologia: null })}
            aria-current={tab === t.key ? "page" : undefined}
            className={cx(
              "-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key
                ? "border-brand-600 text-brand-800"
                : "border-transparent text-stone-500 hover:text-stone-800",
            )}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 text-xs text-stone-400">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "biblioteca" && (
        <LibraryTab
          project={project}
          resources={mine}
          category={category}
          onCategory={(c) => setParams({ cat: c || null })}
        />
      )}
      {tab === "tipologias" && (
        <TypologiesTab
          project={project}
          typologies={myTypologies}
          resources={mine}
          selectedId={typologyId}
          onSelect={(t) => setParams({ tipologia: t })}
        />
      )}
      {tab === "informacion" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/80 lg:col-span-2">
            <h2 className="text-sm font-semibold text-stone-900">Información comercial</h2>
            {project.commercial_info ? (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-stone-700">
                {project.commercial_info}
              </p>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Aún no se ha registrado información comercial.</p>
            )}
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/80">
            <h2 className="text-sm font-semibold text-stone-900">Ficha del proyecto</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {(
                [
                  ["Estado", STATUS_MAP[project.status].label],
                  ["Ubicación", project.location || "—"],
                  ["Descripción", project.description || "—"],
                  ["Tipologías", String(myTypologies.length)],
                  ["Materiales", String(mine.length)],
                  ["Última actualización", formatDateTime(project.last_activity_at)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-stone-500">{label}</dt>
                  <dd className="mt-0.5 text-stone-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {editing && <ProjectFormDialog project={project} onClose={() => setEditing(false)} />}
      {uploading && (
        <UploadDialog
          project={project}
          defaultCategory={tab === "biblioteca" ? CATEGORIES.find((c) => c.key === category)?.key : undefined}
          typologyId={tab === "tipologias" && typologyId ? typologyId : undefined}
          onClose={() => setUploading(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
        title="Eliminar proyecto"
        confirmLabel="Eliminar proyecto"
        text={`Se eliminará "${project.name}" junto con sus ${mine.length} materiales y ${myTypologies.length} tipologías. Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
