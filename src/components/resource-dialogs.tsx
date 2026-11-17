"use client";

import { AlertCircle, CheckCircle2, FileUp, Link2, RefreshCw, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { CATEGORIES, CATEGORY_TREE } from "@/lib/constants";
import { isHttpUrl } from "@/lib/embed";
import { errorMessage } from "@/lib/errors";
import { removeObjects, uploadResourceFile } from "@/lib/files";
import { formatBytes, prettyName } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { CategoryKey, Project, Resource } from "@/lib/types";
import { useData } from "./data-provider";
import { useToast } from "./toast";
import { Button, cx, ErrorNote, Field, IconButton, inputClass, Modal } from "./ui";

interface UploadItem {
  id: string;
  file: File;
  name: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function CategorySelect({ value, onChange }: { value: CategoryKey; onChange: (v: CategoryKey) => void }) {
  const groupedKeys: CategoryKey[] = CATEGORY_TREE.groups.flatMap((group) =>
    group.categories.map((category) => category.key),
  );
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as CategoryKey)}>
      {CATEGORY_TREE.groups.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.categories.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </optgroup>
      ))}
      {CATEGORIES.filter((c) => !groupedKeys.includes(c.key)).map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function TypologySelect({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { typologies } = useData();
  const options = typologies.filter((t) => t.project_id === projectId);
  if (!options.length) return null;
  return (
    <Field label="Tipología (opcional)">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin tipología · material general</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Subir uno o varios archivos, o registrar un enlace externo. */
export function UploadDialog({
  project,
  defaultCategory,
  typologyId,
  onClose,
}: {
  project: Project;
  defaultCategory?: CategoryKey;
  typologyId?: string;
  onClose: () => void;
}) {
  const { upsert } = useData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"files" | "link">("files");
  const [category, setCategory] = useState<CategoryKey>(defaultCategory ?? "brochures");
  const [typology, setTypology] = useState(typologyId ?? "");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<UploadItem>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const addFiles = (files: FileList | File[]) => {
    const fresh = Array.from(files).map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      name: prettyName(file.name),
      progress: 0,
      status: "pending",
    }));
    setItems((list) => [...list, ...fresh]);
  };

  const uploadAll = async () => {
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    let ok = 0;
    let failed = 0;

    for (const item of items) {
      if (item.status === "done") continue;
      const name = item.name.trim() || prettyName(item.file.name);
      patch(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        const meta = await uploadResourceFile(project.id, item.id, item.file, (f) =>
          patch(item.id, { progress: f }),
        );
        const { data, error: insertError } = await supabase
          .from("resources")
          .insert({
            id: item.id,
            project_id: project.id,
            typology_id: typology || null,
            category,
            name,
            kind: "file",
            ...meta,
          })
          .select()
          .single();
        if (insertError) {
          await removeObjects([meta.storage_path, meta.thumb_path]);
          throw insertError;
        }
        upsert("resources", data as Resource);
        patch(item.id, { status: "done", progress: 1 });
        ok++;
      } catch (e) {
        patch(item.id, { status: "error", error: errorMessage(e) });
        failed++;
      }
    }

    setBusy(false);
    if (ok) {
      toast({
        title: ok === 1 ? "Material publicado" : `${ok} materiales publicados`,
        description: "Ya está disponible para todo el equipo.",
      });
    }
    if (!failed) onClose();
  };

  const saveLink = async () => {
    const url = linkUrl.trim();
    if (!linkName.trim()) return setError("Escribe un nombre para el enlace.");
    if (!isHttpUrl(url)) return setError("Escribe un enlace válido que empiece con https://");
    setBusy(true);
    setError(null);
    const { data, error: insertError } = await getSupabase()
      .from("resources")
      .insert({
        project_id: project.id,
        typology_id: typology || null,
        category,
        name: linkName.trim(),
        kind: "link",
        external_url: url,
      })
      .select()
      .single();
    setBusy(false);
    if (insertError) return setError(errorMessage(insertError));
    upsert("resources", data as Resource);
    toast({ title: "Enlace publicado", description: "Ya está disponible para todo el equipo." });
    onClose();
  };

  const remaining = items.filter((i) => i.status !== "done").length;

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      size="lg"
      title="Agregar material"
      subtitle={project.name}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {mode === "files" ? (
            <Button variant="primary" onClick={uploadAll} loading={busy} disabled={!remaining}>
              {busy ? "Subiendo…" : remaining > 1 ? `Publicar ${remaining} archivos` : "Publicar"}
            </Button>
          ) : (
            <Button variant="primary" onClick={saveLink} loading={busy}>
              Publicar enlace
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-[13px] font-medium">
          {(
            [
              ["files", "Archivos", FileUp],
              ["link", "Enlace externo", Link2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(key);
                setError(null);
              }}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
                mode === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>
          <TypologySelect projectId={project.id} value={typology} onChange={setTypology} />
        </div>

        {mode === "files" ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              className={cx(
                "flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
                dragging ? "border-brand-500 bg-brand-50" : "border-stone-300 bg-stone-50",
              )}
            >
              <UploadCloud className="mb-2 size-7 text-stone-400" />
              <p className="text-sm text-stone-700">
                Arrastra archivos aquí o{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="font-medium text-brand-700 underline underline-offset-2"
                >
                  selecciónalos
                </button>
              </p>
              <p className="mt-1 text-xs text-stone-500">Imágenes, PDF, videos, presentaciones y documentos.</p>
              <p className="mt-1 text-xs text-stone-500">
                Las imágenes JPG y PNG se optimizan sin reducir su resolución; si no quedan más livianas, se conserva
                el archivo original.
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-stone-200">
                    <div className="flex items-center gap-2">
                      <input
                        className={cx(inputClass, "h-8 py-1")}
                        value={item.name}
                        aria-label="Nombre del material"
                        disabled={busy || item.status === "done"}
                        onChange={(e) => patch(item.id, { name: e.target.value })}
                      />
                      {item.status === "done" ? (
                        <CheckCircle2 className="size-5 shrink-0 text-brand-600" />
                      ) : item.status === "error" ? (
                        <AlertCircle className="size-5 shrink-0 text-red-500" />
                      ) : null}
                      {item.status !== "done" && (
                        <IconButton
                          label="Quitar"
                          disabled={busy}
                          className="size-8"
                          onClick={() => setItems((list) => list.filter((i) => i.id !== item.id))}
                        >
                          <X className="size-4" />
                        </IconButton>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-stone-500">
                      {item.file.name} · {formatBytes(item.file.size)}
                    </p>
                    {item.status === "uploading" && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-[width]"
                          style={{ width: `${Math.round(item.progress * 100)}%` }}
                        />
                      </div>
                    )}
                    {item.error && <p className="mt-1.5 text-xs text-red-600">{item.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="grid gap-4">
            <Field label="Nombre">
              <input
                className={inputClass}
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Recorrido virtual 360°"
              />
            </Field>
            <Field
              label="Enlace"
              hint="YouTube, Vimeo y Matterport se reproducen dentro del sistema; otros enlaces se abren en una pestaña nueva."
            >
              <input
                className={inputClass}
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

/** Editar los datos de un material y, si se desea, reemplazar su archivo. */
export function ResourceEditDialog({
  resource,
  focusReplace,
  onClose,
}: {
  resource: Resource;
  focusReplace?: boolean;
  onClose: () => void;
}) {
  const { upsert } = useData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(resource.name);
  const [category, setCategory] = useState<CategoryKey>(resource.category);
  const [typology, setTypology] = useState(resource.typology_id ?? "");
  const [url, setUrl] = useState(resource.external_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFile = resource.kind === "file";

  const save = async () => {
    if (!name.trim()) return setError("El nombre no puede quedar vacío.");
    if (!isFile && !isHttpUrl(url.trim())) return setError("Escribe un enlace válido que empiece con https://");
    setBusy(true);
    setError(null);
    try {
      const changes: Record<string, unknown> = { name: name.trim(), category, typology_id: typology || null };
      let uploaded: Awaited<ReturnType<typeof uploadResourceFile>> | null = null;
      if (!isFile) changes.external_url = url.trim();
      if (isFile && file) {
        uploaded = await uploadResourceFile(resource.project_id, resource.id, file, setProgress);
        Object.assign(changes, uploaded);
      }
      const { data, error: updateError } = await getSupabase()
        .from("resources")
        .update(changes)
        .eq("id", resource.id)
        .select()
        .single();
      if (updateError) {
        if (uploaded) await removeObjects([uploaded.storage_path, uploaded.thumb_path]);
        throw updateError;
      }
      upsert("resources", data as Resource);
      // La versión anterior se retira: solo queda disponible el archivo vigente.
      if (uploaded) await removeObjects([resource.storage_path, resource.thumb_path]);
      toast(
        uploaded
          ? {
              title: `Archivo reemplazado · versión ${(data as Resource).version}`,
              description: "Todo el equipo ya ve la nueva versión.",
            }
          : { title: "Cambios guardados" },
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      title={focusReplace && isFile ? "Reemplazar archivo" : "Editar material"}
      subtitle={resource.name}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {busy && file ? `Subiendo ${Math.round(progress * 100)}%` : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isFile ? (
          <div className="rounded-xl bg-stone-50 p-3.5 ring-1 ring-stone-200 ring-inset">
            <p className="text-[13px] font-medium text-stone-700">Archivo</p>
            <p className="mt-1 truncate text-sm text-stone-600">
              {file ? (
                <>
                  <span className="font-medium text-brand-700">Nuevo:</span> {file.name} · {formatBytes(file.size)}
                </>
              ) : (
                <>
                  {resource.file_name} · {formatBytes(resource.size_bytes)} · versión {resource.version}
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={focusReplace && !file ? "primary" : "secondary"}
                icon={<RefreshCw className="size-3.5" />}
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {file ? "Elegir otro archivo" : "Elegir archivo nuevo"}
              </Button>
              {file && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setFile(null)}>
                  Conservar el actual
                </Button>
              )}
            </div>
            <p className="mt-2.5 text-xs text-stone-500">
              Al reemplazarlo se conserva el mismo registro y el mismo enlace para compartir; el equipo verá
              únicamente la versión nueva.
            </p>
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <Field label="Enlace">
            <input
              className={inputClass}
              type="url"
              inputMode="url"
              value={url}
              autoFocus={focusReplace}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        )}

        <Field label="Nombre">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>
          <TypologySelect projectId={resource.project_id} value={typology} onChange={setTypology} />
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}
