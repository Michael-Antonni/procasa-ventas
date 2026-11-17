"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/** ¿Este navegador puede mostrar un PDF incrustado de forma cómoda? */
function canEmbedPdf(): boolean {
  const enabled = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled;
  // En pantallas táctiles el visor incrustado suele mostrar solo la primera página.
  return enabled !== false && !window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Vista previa de un PDF dentro de la página. Donde el navegador no puede
 * incrustarlo (celulares y tablets), ofrece abrirlo en su visor nativo.
 */
export function PdfView({
  url,
  title,
  dark,
  className,
  extra,
}: {
  url: string;
  title: string;
  dark?: boolean;
  className?: string;
  extra?: ReactNode;
}) {
  const embed = useSyncExternalStore(subscribe, canEmbedPdf, () => true);

  if (embed) return <iframe src={url} title={title} className={className} />;

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <FileText className={dark ? "size-12 text-white/50" : "size-12 text-stone-400"} />
      <p className={dark ? "text-sm text-stone-300" : "text-sm text-stone-600"}>
        Abre el PDF para verlo en tu dispositivo.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={
            dark
              ? "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-200"
              : "inline-flex h-10 items-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700"
          }
        >
          <ExternalLink className="size-4" /> Abrir PDF
        </a>
        {extra}
      </div>
    </div>
  );
}
