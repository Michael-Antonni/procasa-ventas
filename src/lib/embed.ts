/**
 * Devuelve la URL para incrustar un enlace externo (videos y recorridos
 * virtuales de servicios conocidos), o null si debe abrirse en otra pestaña.
 */
export function embedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const safeId = (id: string | undefined | null) => (id && /^[\w-]{5,20}$/.test(id) ? id : null);

  if (host === "youtu.be") {
    const id = safeId(parts[0]);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = safeId(
      parts[0] === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null,
    );
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    return /^\d+$/.test(parts[0] ?? "") ? `https://player.vimeo.com/video/${parts[0]}` : null;
  }
  if (host === "player.vimeo.com" || host === "my.matterport.com" || host === "kuula.co") {
    return url.toString();
  }
  return null;
}

export function hostOf(raw: string | null | undefined): string {
  try {
    return new URL(raw ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
