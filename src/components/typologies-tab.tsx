"use client";

import { ArrowLeft, Bath, BedDouble, LayoutGrid, MoreHorizontal, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { fileKind, plural } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { Project, Resource, Typology } from "@/lib/types";
import { useData } from "./data-provider";
import { useViewMode } from "./library-tab";
import { TypologyFormDialog } from "./project-ui";
import { UploadDialog } from "./resource-dialogs";
import { ResourceList, ViewToggle } from "./resource-list";
import { ResourceThumb } from "./resource-thumb";
import { useToast } from "./toast";
import { Button, ConfirmDialog, EmptyState, IconButton, Menu, MenuItem } from "./ui";

const PLAN_CATEGORIES = ["planos"];
const RENDER_CATEGORIES = ["departamentos_atipicos_renders", "departamentos_tipicos_renders"];
const TYPOLOGY_CATEGORIES = ["departamentos_atipicos_tipologias", "departamentos_tipicos_tipologias"];
const VIEW_360_CATEGORIES = ["departamentos_atipicos_vistas_360", "departamentos_tipicos_vistas_360"];

function Specs({ typology, large }: { typology: Typology; large?: boolean }) {
  const items = [
    typology.area_m2 != null && { icon: Ruler, text: `${typology.area_m2} m²` },
    typology.bedrooms != null && {
      icon: BedDouble,
      text: large ? plural(typology.bedrooms, "dormitorio", "dormitorios") : `${typology.bedrooms} dorm.`,
    },
    typology.bathrooms != null && {
      icon: Bath,
      text: large
        ? `${typology.bathrooms} ${typology.bathrooms === 1 ? "baño" : "baños"}`
        : `${typology.bathrooms} ${typology.bathrooms === 1 ? "baño" : "baños"}`,
    },
  ].filter(Boolean) as { icon: typeof Ruler; text: string }[];
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-stone-600 ${large ? "text-sm" : "text-[13px]"}`}>
      {items.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <Icon className="size-4 text-stone-400" /> {text}
        </span>
      ))}
    </div>
  );
}

export function TypologiesTab({
  project,
  typologies,
  resources,
  selectedId,
  onSelect,
}: {
  project: Project;
  typologies: Typology[];
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string | null) => void;
}) {
  const { isAdmin, remove } = useData();
  const toast = useToast();
  const [view, setView] = useViewMode();
  const [form, setForm] = useState<{ typology?: Typology } | null>(null);
  const [deleting, setDeleting] = useState<Typology | null>(null);
  const [uploading, setUploading] = useState(false);

  const byTypology = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of resources) {
      if (r.typology_id) map.set(r.typology_id, [...(map.get(r.typology_id) ?? []), r]);
    }
    return map;
  }, [resources]);

  const selected = typologies.find((t) => t.id === selectedId);

  const confirmDelete = async () => {
    const t = deleting;
    if (!t) return;
    const { error } = await getSupabase().from("typologies").delete().eq("id", t.id);
    if (error) throw new Error(errorMessage(error));
    remove("typologies", t.id);
    if (selectedId === t.id) onSelect(null);
    toast({ title: "Tipología eliminada", description: "Sus archivos siguen en la biblioteca del proyecto." });
  };

  const menu = (t: Typology) =>
    isAdmin && (
      <Menu
        trigger={(props) => (
          <IconButton label="Opciones de la tipología" {...props}>
            <MoreHorizontal className="size-4" />
          </IconButton>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon={<Pencil className="size-4" />}
              onClick={() => {
                close();
                setForm({ typology: t });
              }}
            >
              Editar tipología
            </MenuItem>
            <MenuItem
              danger
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                close();
                setDeleting(t);
              }}
            >
              Eliminar
            </MenuItem>
          </>
        )}
      </Menu>
    );

  const dialogs = (
    <>
      {form && (
        <TypologyFormDialog
          projectId={project.id}
          typology={form.typology}
          onClose={() => setForm(null)}
          onSaved={(t) => !form.typology && onSelect(t.id)}
        />
      )}
      {uploading && selected && (
        <UploadDialog
          project={project}
          typologyId={selected.id}
          defaultCategory="departamentos_tipicos_tipologias"
          onClose={() => setUploading(false)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Eliminar tipología"
        text={`Se eliminará "${deleting?.name ?? ""}". Sus archivos no se borran: quedan en la biblioteca del proyecto, sin tipología asignada.`}
      />
    </>
  );

  // ---------------- Detalle de una tipología ----------------
  if (selected) {
    const files = (byTypology.get(selected.id) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const sections = [
      { title: "Plano de distribución", items: files.filter((r) => PLAN_CATEGORIES.includes(r.category)) },
      { title: "Renders", items: files.filter((r) => RENDER_CATEGORIES.includes(r.category)) },
      {
        title: "Tipologías del departamento",
        items: files.filter((r) => TYPOLOGY_CATEGORIES.includes(r.category)),
      },
      { title: "Vistas 360", items: files.filter((r) => VIEW_360_CATEGORIES.includes(r.category)) },
      {
        title: "Archivos relacionados",
        items: files.filter(
          (r) =>
            ![...PLAN_CATEGORIES, ...RENDER_CATEGORIES, ...TYPOLOGY_CATEGORIES, ...VIEW_360_CATEGORIES].includes(
              r.category,
            ),
        ),
      },
    ].filter((s) => s.items.length);

    return (
      <div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="size-4" /> Todas las tipologías
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/80 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-stone-900">{selected.name}</h2>
              <div className="mt-2">
                <Specs typology={selected} large />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isAdmin && (
                <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setUploading(true)}>
                  <span className="hidden sm:inline">Agregar archivo</span>
                </Button>
              )}
              {menu(selected)}
            </div>
          </div>
          {selected.description && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-stone-600">
              {selected.description}
            </p>
          )}
        </div>

        {sections.length ? (
          <div className="mt-6 space-y-8">
            <div className="flex justify-end">
              <ViewToggle view={view} onChange={setView} />
            </div>
            {sections.map((s) => (
              <section key={s.title} className="!mt-0">
                <div className="mb-3 flex items-baseline gap-2 pt-2">
                  <h3 className="text-sm font-semibold text-stone-900">{s.title}</h3>
                  <span className="text-xs text-stone-400">{s.items.length}</span>
                </div>
                <ResourceList resources={s.items} view={view} />
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<LayoutGrid className="size-6" />}
              title="Esta tipología aún no tiene archivos"
              text={
                isAdmin
                  ? "Agrega su plano de distribución, renders y otros archivos."
                  : "Cuando el administrador suba su plano y renders, aparecerán aquí."
              }
            />
          </div>
        )}
        {dialogs}
      </div>
    );
  }

  // ---------------- Lista de tipologías ----------------
  return (
    <div>
      {isAdmin && typologies.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>
            Nueva tipología
          </Button>
        </div>
      )}

      {typologies.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {typologies.map((t) => {
            const files = byTypology.get(t.id) ?? [];
            const images = files.filter((r) => fileKind(r) === "image");
            const cover = images.find((r) => PLAN_CATEGORIES.includes(r.category)) ?? images[0] ?? files[0];
            return (
              <li
                key={t.id}
                className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80 transition hover:shadow-md hover:ring-stone-300"
              >
                <button type="button" onClick={() => onSelect(t.id)} className="block w-full text-left">
                  {cover ? (
                    <ResourceThumb resource={cover} className="aspect-[16/10] w-full" />
                  ) : (
                    <div className="flex aspect-[16/10] w-full items-center justify-center bg-stone-100 text-stone-300">
                      <LayoutGrid className="size-10" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="truncate pr-8 text-[15px] font-semibold text-stone-900">{t.name}</h3>
                    <div className="mt-2">
                      <Specs typology={t} />
                    </div>
                    <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
                      {plural(files.length, "archivo", "archivos")}
                    </p>
                  </div>
                </button>
                <div className="absolute top-2 right-2 rounded-lg bg-white/95 shadow-sm empty:hidden">{menu(t)}</div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<LayoutGrid className="size-6" />}
          title="Aún no hay tipologías"
          text={
            isAdmin
              ? "Registra los tipos de departamento del proyecto con su área, dormitorios, plano y renders."
              : "Cuando el administrador registre los tipos de departamento, aparecerán aquí."
          }
          action={
            isAdmin && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({})}>
                Nueva tipología
              </Button>
            )
          }
        />
      )}
      {dialogs}
    </div>
  );
}
