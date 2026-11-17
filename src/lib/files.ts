import { useEffect, useState } from "react";
import { BUCKET } from "./constants";
import { extensionOf, safeFileName } from "./format";
import { optimizeImage } from "./image-optimization";
import { getSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/client";
import type { Resource } from "./types";

// ---------------------------------------------------------------------
// Enlaces firmados (el bucket es privado). Se piden por lotes y se guardan
// en memoria: como cada versión de un archivo tiene su propia ruta, un
// enlace guardado nunca apunta a una versión antigua.
// ---------------------------------------------------------------------

const TTL_SECONDS = 3600;
const cache = new Map<string, { url: string; exp: number }>();
let queue = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

function cachedUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : null;
}

async function flush() {
  timer = null;
  const batch = queue;
  queue = new Map();
  const paths = [...batch.keys()];
  const found = new Map<string, string>();
  try {
    const { data } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS);
    data?.forEach((d) => {
      if (d.path && d.signedUrl) found.set(d.path, d.signedUrl);
    });
  } catch {
    // Sin conexión: se resuelve con null y la interfaz muestra el ícono del archivo.
  }
  for (const [path, resolvers] of batch) {
    const url = found.get(path) ?? null;
    if (url) cache.set(path, { url, exp: Date.now() + (TTL_SECONDS - 300) * 1000 });
    resolvers.forEach((resolve) => resolve(url));
  }
}

export function getSignedUrl(path: string): Promise<string | null> {
  const hit = cachedUrl(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const waiting = queue.get(path);
    if (waiting) waiting.push(resolve);
    else queue.set(path, [resolve]);
    if (!timer) timer = setTimeout(flush, 25);
  });
}

/** Enlace temporal para mostrar un archivo. null mientras carga o si no existe. */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [state, setState] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    getSignedUrl(path).then((url) => {
      if (alive) setState({ path, url });
    });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return null;
  return state?.path === path ? state.url : cachedUrl(path);
}

// ---------------------------------------------------------------------
// Descargar y compartir
// ---------------------------------------------------------------------

export function downloadName(r: Pick<Resource, "name" | "extension" | "file_name">): string {
  const base = r.name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "archivo";
  if (!r.extension) return r.file_name || base;
  return base.toLowerCase().endsWith(`.${r.extension}`) ? base : `${base}.${r.extension}`;
}

export async function downloadResource(r: Resource): Promise<void> {
  if (r.kind === "link" || !r.storage_path) {
    if (r.external_url) window.open(r.external_url, "_blank", "noopener");
    return;
  }
  const name = downloadName(r);
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(r.storage_path, 300, { download: name });
  if (error || !data) throw new Error("No se pudo preparar la descarga. Inténtalo de nuevo.");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Enlace público que siempre abre la versión vigente del material. */
export function shareUrl(r: Pick<Resource, "share_token">): string {
  return `${window.location.origin}/r/${r.share_token}`;
}

/** En celulares abre el menú nativo de compartir; en escritorio copia el enlace. */
export async function shareResource(r: Resource, projectName?: string): Promise<"shared" | "copied" | "cancelled"> {
  const url = shareUrl(r);
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: projectName ? `${r.name} · ${projectName}` : r.name, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  await copyText(url);
  return "copied";
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// ---------------------------------------------------------------------
// Subida de archivos (con progreso)
// ---------------------------------------------------------------------

function uploadObject(
  path: string,
  body: Blob,
  contentType: string,
  token: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "";
      try {
        message = JSON.parse(xhr.responseText)?.message ?? "";
      } catch {}
      if (xhr.status === 413 || /maximum allowed size|too large/i.test(message)) {
        reject(new Error("El archivo supera el tamaño máximo permitido por el almacenamiento."));
      } else if (xhr.status === 401 || xhr.status === 403) {
        reject(new Error("No tienes permiso para subir archivos."));
      } else {
        reject(new Error(message || `No se pudo subir el archivo (error ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Se perdió la conexión mientras se subía el archivo."));
    xhr.send(body);
  });
}

async function accessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  return token;
}

/** Copia reducida de una imagen (para miniaturas y portadas). null si no es una imagen legible. */
async function resizeImage(file: Blob, maxSide: number, quality: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  } catch {
    return null;
  }
}

const blobExt = (b: Blob) => (b.type === "image/webp" ? "webp" : b.type === "image/jpeg" ? "jpg" : "png");

export interface UploadedFile {
  storage_path: string;
  thumb_path: string | null;
  file_name: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
}

/**
 * Sube un archivo (y su miniatura si es una imagen) a
 * {proyecto}/{recurso}/{marca-de-tiempo}-{nombre}.
 */
export async function uploadResourceFile(
  projectId: string,
  resourceId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> {
  const token = await accessToken();
  const stamp = Date.now();
  const folder = `${projectId}/${resourceId}`;
  const body = await optimizeImage(file);
  const ext = body === file ? extensionOf(file.name) : blobExt(body);
  const originalBase = file.name.replace(/\.[^.]+$/, "");
  const fileName = body === file ? file.name : `${originalBase}.${ext}`;
  const storagePath = `${folder}/${stamp}-${safeFileName(fileName)}`;
  const mime = file.type || "application/octet-stream";

  await uploadObject(storagePath, body, body.type || mime, token, onProgress);

  let thumbPath: string | null = null;
  if (mime.startsWith("image/")) {
    const thumb = await resizeImage(file, 640, 0.8);
    if (thumb) {
      const path = `${folder}/thumb-${stamp}.${blobExt(thumb)}`;
      try {
        await uploadObject(path, thumb, thumb.type, token);
        thumbPath = path;
      } catch {
        // Sin miniatura se muestra la imagen original.
      }
    }
  }

  return {
    storage_path: storagePath,
    thumb_path: thumbPath,
    file_name: fileName,
    mime_type: body.type || mime,
    extension: ext,
    size_bytes: body.size,
  };
}

/** Sube la portada de un proyecto, optimizada sin reducir su resolución. */
export async function uploadCover(projectId: string, file: File): Promise<string> {
  const token = await accessToken();
  const body = await optimizeImage(file);
  const ext = body === file ? extensionOf(file.name) || "jpg" : blobExt(body);
  const path = `${projectId}/portada-${Date.now()}.${ext}`;
  await uploadObject(path, body, body.type || "image/jpeg", token);
  return path;
}

/** Borra archivos del almacenamiento. No falla si alguno ya no existe. */
export async function removeObjects(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  try {
    for (let i = 0; i < list.length; i += 100) {
      await getSupabase()
        .storage.from(BUCKET)
        .remove(list.slice(i, i + 100));
    }
  } catch {
    // Un archivo huérfano no afecta a los usuarios: el registro ya no lo referencia.
  }
}
