"use client";

import { Download, FolderInput, MoreHorizontal, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { CATEGORY_SHORT } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { removeObjects } from "@/lib/files";
import { formatBytes, formatLabel, recentBadge, timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { Resource } from "@/lib/types";
import { useData } from "./data-provider";
import { useResourceActions } from "./resource-actions";
import { ResourceEditDialog } from "./resource-dialogs";
import { ResourceThumb } from "./resource-thumb";
import { useToast } from "./toast";
import { ConfirmDialog, cx, IconButton, Menu, MenuItem, RecentBadge } from "./ui";
import { useViewer } from "./viewer";

export type ViewMode = "grid" | "list";

const CARD_BUTTON =
  "flex size-8 items-center justify-center rounded-lg bg-white/95 text-stone-700 shadow-sm transition-colors hover:bg-white hover:text-stone-950";

/**
 * Lista de materiales en cuadrícula o en filas. Al hacer clic se abre el
 * visor, que permite recorrer toda la lista como una galería.
 */
export function ResourceList({
  resources,
  view = "grid",
  showProject,
}: {
  resources: Resource[];
  view?: ViewMode;
  showProject?: boolean;
}) {
  const { isAdmin, projectById, now, remove } = useData();
  const viewer = useViewer();
  const toast = useToast();
  const { download, share } = useResourceActions();
  const [editing, setEditing] = useState<{ resource: Resource; replace: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);

  const ids = resources.map((r) => r.id);
  const open = (r: Resource) => viewer.open(ids, r.id);

  const confirmDelete = async () => {
    const r = deleting;
    if (!r) return;
    const { error } = await getSupabase().from("resources").delete().eq("id", r.id);
    if (error) throw new Error(errorMessage(error));
    remove("resources", r.id);
    await removeObjects([r.storage_path, r.thumb_path]);
    toast({ title: "Material eliminado" });
  };

  const meta = (r: Resource) =>
    [showProject ? projectById.get(r.project_id)?.name : CATEGORY_SHORT[r.category], formatLabel(r)]
      .filter(Boolean)
      .join(" · ");

  const adminMenu = (r: Resource, tone: "card" | "row") =>
    isAdmin && (
      <Menu
        trigger={(props) =>
          tone === "card" ? (
            <button type="button" aria-label="Opciones" title="Opciones" {...props} className={CARD_BUTTON}>
              <MoreHorizontal className="size-4" />
            </button>
          ) : (
            <IconButton label="Opciones" {...props}>
              <MoreHorizontal className="size-4" />
            </IconButton>
          )
        }
      >
        {(close) => (
          <>
            <MenuItem
              icon={<Pencil className="size-4" />}
              onClick={() => {
                close();
                setEditing({ resource: r, replace: false });
              }}
            >
              Editar datos
            </MenuItem>
            <MenuItem
              icon={r.kind === "file" ? <RefreshCw className="size-4" /> : <FolderInput className="size-4" />}
              onClick={() => {
                close();
                setEditing({ resource: r, replace: true });
              }}
            >
              {r.kind === "file" ? "Reemplazar archivo" : "Cambiar enlace"}
            </MenuItem>
            <MenuItem
              danger
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                close();
                setDeleting(r);
              }}
            >
              Eliminar
            </MenuItem>
          </>
        )}
      </Menu>
    );

  return (
    <>
      {view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
          {resources.map((r) => {
            const badge = recentBadge(r, now);
            return (
              <li
                key={r.id}
                className="group relative rounded-xl bg-white shadow-sm ring-1 ring-stone-200/80 transition hover:shadow-md hover:ring-stone-300"
              >
                <button type="button" onClick={() => open(r)} className="block w-full text-left">
                  <ResourceThumb resource={r} className="aspect-[4/3] w-full rounded-t-xl" />
                  <span className="block px-3 pt-2.5 pb-3">
                    <span className="block truncate text-[13px] font-medium text-stone-900" title={r.name}>
                      {r.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">{meta(r)}</span>
                    <span className="mt-0.5 block truncate text-xs text-stone-400">
                      {timeAgo(r.updated_at, now)}
                    </span>
                  </span>
                </button>
                {badge && (
                  <span className="pointer-events-none absolute top-2 left-2">
                    <RecentBadge label={badge} />
                  </span>
                )}
                <div className="absolute top-2 right-2 flex gap-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 sm:opacity-0">
                  <div className="hidden gap-1 sm:flex">
                    <button type="button" aria-label="Compartir enlace" title="Compartir enlace" onClick={() => share(r)} className={CARD_BUTTON}>
                      <Share2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={r.kind === "link" ? "Abrir enlace" : "Descargar"}
                      title={r.kind === "link" ? "Abrir enlace" : "Descargar"}
                      onClick={() => download(r)}
                      className={CARD_BUTTON}
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                  {adminMenu(r, "card")}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl bg-white shadow-sm ring-1 ring-stone-200/80">
          {resources.map((r) => {
            const badge = recentBadge(r, now);
            return (
              <li key={r.id} className="flex items-center gap-1 pr-2 first:rounded-t-xl last:rounded-b-xl hover:bg-stone-50">
                <button
                  type="button"
                  onClick={() => open(r)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
                >
                  <ResourceThumb resource={r} compact className="size-11 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-stone-900">{r.name}</span>
                      {badge && <RecentBadge label={badge} />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {[meta(r), formatBytes(r.size_bytes)].filter(Boolean).join(" · ")}
                      <span className="md:hidden"> · {timeAgo(r.updated_at, now)}</span>
                    </span>
                  </span>
                  <span className="hidden w-32 shrink-0 text-right text-xs text-stone-500 md:block">
                    {timeAgo(r.updated_at, now)}
                  </span>
                </button>
                <IconButton label="Compartir enlace" onClick={() => share(r)}>
                  <Share2 className="size-4" />
                </IconButton>
                <IconButton label={r.kind === "link" ? "Abrir enlace" : "Descargar"} onClick={() => download(r)}>
                  <Download className="size-4" />
                </IconButton>
                {adminMenu(r, "row")}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ResourceEditDialog
          resource={editing.resource}
          focusReplace={editing.replace}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Eliminar material"
        text={`"${deleting?.name ?? ""}" dejará de estar disponible para todo el equipo y los enlaces compartidos dejarán de funcionar. Esta acción no se puede deshacer.`}
      />
    </>
  );
}

export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-stone-100 p-0.5 text-[13px] font-medium">
      {(["grid", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={cx(
            "rounded-md px-2.5 py-1.5 transition-colors",
            view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {v === "grid" ? "Galería" : "Lista"}
        </button>
      ))}
    </div>
  );
}
