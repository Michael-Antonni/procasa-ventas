import { RECENT_DAYS } from "./constants";
import type { Resource } from "./types";

export type FileKind = "image" | "pdf" | "video" | "audio" | "document" | "link";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "bmp"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogv"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "ogg", "aac"];

export function fileKind(r: Pick<Resource, "kind" | "mime_type" | "extension">): FileKind {
  if (r.kind === "link") return "link";
  const ext = (r.extension || "").toLowerCase();
  const mime = r.mime_type || "";
  if (mime.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("video/") || VIDEO_EXT.includes(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXT.includes(ext)) return "audio";
  return "document";
}

/** Los filtros agrupan el audio junto con los documentos. */
export function filterKind(r: Pick<Resource, "kind" | "mime_type" | "extension">) {
  const k = fileKind(r);
  return k === "audio" ? "document" : k;
}

export function formatLabel(r: Pick<Resource, "kind" | "extension">): string {
  if (r.kind === "link") return "ENLACE";
  return (r.extension || "archivo").toUpperCase();
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** "hace 5 min", "hace 3 h", "ayer"… y la fecha completa después de una semana. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return formatDate(iso);
}

export function isRecent(iso: string, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() < RECENT_DAYS * 86_400_000;
}

/** Etiqueta para materiales con cambios recientes; null si no aplica. */
export function recentBadge(r: Pick<Resource, "updated_at" | "version">, now?: number): string | null {
  if (!isRecent(r.updated_at, now)) return null;
  return r.version > 1 ? "Actualizado" : "Nuevo";
}

/** Minúsculas y sin tildes, para comparar textos al buscar. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/** "Brochure_Torre-Alba v2.pdf" -> "Brochure Torre Alba v2" */
export function prettyName(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  const base = i > 0 ? fileName.slice(0, i) : fileName;
  const clean = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || fileName;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Nombre seguro para usar como ruta en el almacenamiento. */
export function safeFileName(fileName: string): string {
  const clean = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "");
  return clean.slice(-120) || "archivo";
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
