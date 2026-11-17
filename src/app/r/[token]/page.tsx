import { Building2, Download, ExternalLink, FileText, FileX2 } from "lucide-react";
import type { Metadata } from "next";
import { cache } from "react";
import { PdfView } from "@/components/pdf-view";
import { APP_NAME, BUCKET, CATEGORY_LABEL } from "@/lib/constants";
import { embedUrl, hostOf } from "@/lib/embed";
import { fileKind, formatBytes, formatDate, formatLabel } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import type { Resource } from "@/lib/types";

/**
 * Enlace público para compartir un material con clientes. Siempre entrega la
 * versión vigente: si el administrador reemplaza el archivo, este mismo
 * enlace muestra el nuevo. No requiere iniciar sesión.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };
type Shared = Resource & { projects: { name: string } | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const load = cache(async (token: string) => {
  const admin = createAdminClient();
  if (!admin) return { configured: false as const, resource: null };
  if (!UUID.test(token)) return { configured: true as const, resource: null };
  const { data } = await admin
    .from("resources")
    .select("*, projects(name)")
    .eq("share_token", token)
    .maybeSingle();
  return { configured: true as const, resource: (data as Shared | null) ?? null, admin };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { resource } = await load(token);
  if (!resource) return { title: "Material no disponible" };
  return {
    title: resource.projects?.name ? `${resource.name} · ${resource.projects.name}` : resource.name,
    description: `${CATEGORY_LABEL[resource.category]} compartido desde ${APP_NAME}.`,
  };
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-stone-200 text-stone-500">
          <FileX2 className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{text}</p>
      </div>
    </main>
  );
}

export default async function SharedResourcePage({ params }: Props) {
  const { token } = await params;
  const { configured, resource, admin } = await load(token);

  if (!configured) {
    return (
      <Notice
        title="Enlaces públicos sin configurar"
        text="Falta definir SUPABASE_SERVICE_ROLE_KEY en el servidor para poder compartir materiales."
      />
    );
  }
  if (!resource || !admin) {
    return (
      <Notice
        title="Este material ya no está disponible"
        text="Es posible que haya sido retirado. Pide a tu asesor un enlace actualizado."
      />
    );
  }

  const kind = fileKind(resource);
  let viewUrl: string | null = null;
  let downloadUrl: string | null = null;

  if (resource.kind === "file" && resource.storage_path) {
    const storage = admin.storage.from(BUCKET);
    const fileName = resource.extension ? `${resource.name}.${resource.extension}` : resource.name;
    const [view, download] = await Promise.all([
      storage.createSignedUrl(resource.storage_path, 3 * 3600),
      storage.createSignedUrl(resource.storage_path, 3 * 3600, { download: fileName }),
    ]);
    viewUrl = view.data?.signedUrl ?? null;
    downloadUrl = download.data?.signedUrl ?? null;
    if (!viewUrl) {
      return <Notice title="No se pudo abrir el archivo" text="Inténtalo de nuevo en unos minutos." />;
    }
  }

  const embed = resource.kind === "link" ? embedUrl(resource.external_url) : null;
  const button =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <Building2 className="size-3.5" />
              {resource.projects?.name ?? APP_NAME}
            </p>
            <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-stone-900">{resource.name}</h1>
            <p className="mt-0.5 text-xs text-stone-500">
              {[
                CATEGORY_LABEL[resource.category],
                formatLabel(resource),
                formatBytes(resource.size_bytes),
                `Actualizado el ${formatDate(resource.updated_at)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {downloadUrl && (
            <a href={downloadUrl} className={`${button} bg-brand-600 text-white hover:bg-brand-700`}>
              <Download className="size-4" /> Descargar
            </a>
          )}
          {resource.kind === "link" && resource.external_url && (
            <a
              href={resource.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
            >
              <ExternalLink className="size-4" /> Abrir enlace
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        {kind === "image" && viewUrl && (
          <img src={viewUrl} alt={resource.name} className="mx-auto max-h-[80dvh] max-w-full rounded-xl shadow-sm" />
        )}
        {kind === "video" && viewUrl && (
          <video src={viewUrl} controls playsInline className="mx-auto max-h-[80dvh] w-full rounded-xl bg-black" />
        )}
        {kind === "audio" && viewUrl && <audio src={viewUrl} controls className="mx-auto mt-10 w-full max-w-md" />}
        {kind === "pdf" && viewUrl && (
          <PdfView
            url={viewUrl}
            title={resource.name}
            className="min-h-[75dvh] w-full flex-1 rounded-xl bg-white shadow-sm ring-1 ring-stone-200"
          />
        )}
        {kind === "document" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-12 text-stone-400" />
            <p className="text-sm text-stone-600">Descarga el archivo para abrirlo.</p>
          </div>
        )}
        {kind === "link" &&
          (embed ? (
            <iframe
              src={embed}
              title={resource.name}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen; xr-spatial-tracking"
              allowFullScreen
              className="aspect-video w-full rounded-xl bg-black shadow-sm"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ExternalLink className="size-12 text-stone-400" />
              <p className="text-sm text-stone-600">Este material se abre en {hostOf(resource.external_url)}.</p>
            </div>
          ))}
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-stone-400">Compartido desde {APP_NAME}</footer>
    </div>
  );
}
