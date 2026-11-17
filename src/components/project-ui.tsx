"use client";

import { Building2, ImagePlus, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_MAP, STATUSES } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { removeObjects, uploadCover, useSignedUrl } from "@/lib/files";
import { isRecent, plural, timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { Project, ProjectStatus, Typology } from "@/lib/types";
import { useData } from "./data-provider";
import { useToast } from "./toast";
import { Badge, Button, cx, ErrorNote, Field, inputClass, Modal } from "./ui";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_MAP[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export function ProjectCover({ project, className }: { project: Project; className?: string }) {
  const url = useSignedUrl(project.cover_path);
  return (
    <div
      className={cx(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-200 to-stone-300 text-stone-400",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Building2 className="size-1/4 max-h-12 max-w-12" strokeWidth={1.5} />
      )}
    </div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const { resources, typologies, now } = useData();
  const counts = useMemo(
    () => ({
      resources: resources.filter((r) => r.project_id === project.id).length,
      typologies: typologies.filter((t) => t.project_id === project.id).length,
    }),
    [resources, typologies, project.id],
  );
  const fresh = isRecent(project.last_activity_at, now);

  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-stone-300"
    >
      <div className="relative">
        <ProjectCover project={project} className="aspect-[16/10] w-full" />
        <div className="absolute top-3 left-3">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="truncate text-[15px] font-semibold text-stone-900 group-hover:text-brand-700">
          {project.name}
        </h3>
        <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-stone-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{project.location || "Ubicación por definir"}</span>
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
          <span className="truncate">
            {plural(counts.resources, "material", "materiales")} ·{" "}
            {plural(counts.typologies, "tipología", "tipologías")}
          </span>
          <span className={cx("flex shrink-0 items-center gap-1.5", fresh && "font-medium text-brand-700")}>
            {fresh && <span className="size-1.5 rounded-full bg-brand-500" />}
            {timeAgo(project.last_activity_at, now)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Crear o editar un proyecto. */
export function ProjectFormDialog({
  project,
  onClose,
  onSaved,
}: {
  project?: Project;
  onClose: () => void;
  onSaved?: (p: Project) => void;
}) {
  const { upsert } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project?.name ?? "");
  const [location, setLocation] = useState(project?.location ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "preventa");
  const [description, setDescription] = useState(project?.description ?? "");
  const [info, setInfo] = useState(project?.commercial_info ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentCover = useSignedUrl(project?.cover_path);

  const previewRef = useRef<string | null>(null);

  const pickCover = (file: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setCover(file);
    setPreview(previewRef.current);
  };

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const save = async () => {
    if (!name.trim()) return setError("Escribe el nombre del proyecto.");
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const id = project?.id ?? crypto.randomUUID();
    let newCover: string | null = null;
    try {
      if (cover) newCover = await uploadCover(id, cover);
      const values = {
        name: name.trim(),
        location: location.trim(),
        status,
        description: description.trim(),
        commercial_info: info.trim(),
        ...(newCover ? { cover_path: newCover } : {}),
      };
      const query = project
        ? supabase.from("projects").update(values).eq("id", id)
        : supabase.from("projects").insert({ id, ...values });
      const { data, error: saveError } = await query.select().single();
      if (saveError) throw saveError;
      if (newCover && project?.cover_path) await removeObjects([project.cover_path]);
      upsert("projects", data as Project);
      toast({ title: project ? "Proyecto actualizado" : "Proyecto creado" });
      onSaved?.(data as Project);
      onClose();
    } catch (e) {
      if (newCover) await removeObjects([newCover]);
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const image = preview ?? currentCover;

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      size="lg"
      title={project ? "Editar proyecto" : "Nuevo proyecto"}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {project ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-stone-700">Imagen de portada</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-500 ring-1 ring-stone-200 ring-inset hover:bg-stone-200"
          >
            {image ? (
              <>
                <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Cambiar imagen
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-xs">
                <ImagePlus className="size-6" />
                Elegir imagen
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pickCover(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
        <div className="grid content-start gap-4">
          <Field label="Nombre del proyecto">
            <input
              className={inputClass}
              value={name}
              autoFocus={!project}
              onChange={(e) => setName(e.target.value)}
              placeholder="Residencial Los Álamos"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ubicación">
              <input
                className={inputClass}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Distrito, ciudad"
              />
            </Field>
            <Field label="Estado">
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <Field label="Descripción breve" className="sm:col-span-2">
          <textarea
            className={inputClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Una o dos frases que resuman el proyecto."
          />
        </Field>
        <Field
          label="Información comercial relevante"
          hint="Argumentos de venta, fechas de entrega, formas de pago, bonos, contacto de sala de ventas, etc."
          className="sm:col-span-2"
        >
          <textarea className={inputClass} rows={5} value={info} onChange={(e) => setInfo(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
    </Modal>
  );
}

/** Crear o editar una tipología de departamento. */
export function TypologyFormDialog({
  projectId,
  typology,
  onClose,
  onSaved,
}: {
  projectId: string;
  typology?: Typology;
  onClose: () => void;
  onSaved?: (t: Typology) => void;
}) {
  const { upsert, typologies } = useData();
  const toast = useToast();
  const [name, setName] = useState(typology?.name ?? "");
  const [area, setArea] = useState(typology?.area_m2?.toString() ?? "");
  const [bedrooms, setBedrooms] = useState(typology?.bedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(typology?.bathrooms?.toString() ?? "");
  const [description, setDescription] = useState(typology?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() === "" || Number.isNaN(n) ? null : n;
  };

  const save = async () => {
    if (!name.trim()) return setError("Escribe el nombre de la tipología.");
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const values = {
      name: name.trim(),
      area_m2: num(area),
      bedrooms: num(bedrooms) == null ? null : Math.round(num(bedrooms)!),
      bathrooms: num(bathrooms),
      description: description.trim(),
    };
    const nextOrder =
      Math.max(-1, ...typologies.filter((t) => t.project_id === projectId).map((t) => t.sort_order)) + 1;
    const query = typology
      ? supabase.from("typologies").update(values).eq("id", typology.id)
      : supabase.from("typologies").insert({ project_id: projectId, sort_order: nextOrder, ...values });
    const { data, error: saveError } = await query.select().single();
    if (saveError) {
      setError(errorMessage(saveError));
      setBusy(false);
      return;
    }
    upsert("typologies", data as Typology);
    toast({ title: typology ? "Tipología actualizada" : "Tipología creada" });
    onSaved?.(data as Typology);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      title={typology ? "Editar tipología" : "Nueva tipología"}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {typology ? "Guardar cambios" : "Crear tipología"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nombre de la tipología">
          <input
            className={inputClass}
            value={name}
            autoFocus={!typology}
            onChange={(e) => setName(e.target.value)}
            placeholder="Departamento de 2 dormitorios · Tipo A"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Área (m²)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="68.5"
            />
          </Field>
          <Field label="Dormitorios">
            <input
              className={inputClass}
              inputMode="numeric"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              placeholder="2"
            />
          </Field>
          <Field label="Baños">
            <input
              className={inputClass}
              inputMode="decimal"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              placeholder="2"
            />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea
            className={inputClass}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Distribución, vista, acabados, pisos en los que está disponible…"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}
