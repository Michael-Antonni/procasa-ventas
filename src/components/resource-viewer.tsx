"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize,
  Minimize,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATEGORY_LABEL } from "@/lib/constants";
import { embedUrl, hostOf } from "@/lib/embed";
import { useSignedUrl } from "@/lib/files";
import { fileKind, formatBytes, formatLabel, timeAgo } from "@/lib/format";
import type { Resource } from "@/lib/types";
import { useData } from "./data-provider";
import { PdfView } from "./pdf-view";
import { useResourceActions } from "./resource-actions";
import { KindIcon, ResourceThumb } from "./resource-thumb";
import { cx, IconButton, Spinner } from "./ui";

export default function ResourceViewer({
  ids,
  id,
  onNavigate,
  onClose,
}: {
  ids: string[];
  id: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const { resources, projectById, now } = useData();
  const { download, share } = useResourceActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const touchX = useRef<number | null>(null);

  const items = useMemo(() => {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    return ids.map((resourceId) => byId.get(resourceId)).filter((resource): resource is Resource => Boolean(resource));
  }, [ids, resources]);

  const index = items.findIndex((resource) => resource.id === id);
  const resource = index >= 0 ? items[index] : null;

  const go = useCallback(
    (delta: number) => {
      if (items.length < 2 || index < 0) return;
      onNavigate(items[(index + delta + items.length) % items.length].id);
    },
    [items, index, onNavigate],
  );

  useEffect(() => {
    if (resource) return;
    if (items.length) onNavigate(items[0].id);
    else onClose();
  }, [resource, items, onNavigate, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  if (!resource) return null;
  const project = projectById.get(resource.project_id);
  const kind = fileKind(resource);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={resource.name}
      className="animate-fade fixed inset-0 z-[60] flex flex-col bg-stone-950 text-white"
    >
      <header className="flex items-center gap-2 px-2 py-2 sm:px-4">
        <IconButton label="Cerrar (Esc)" tone="dark" onClick={onClose}>
          <X className="size-5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{resource.name}</p>
          <p className="truncate text-xs text-stone-400">
            {[
              project?.name,
              CATEGORY_LABEL[resource.category],
              formatLabel(resource),
              formatBytes(resource.size_bytes),
              resource.version > 1 ? `Versión ${resource.version}` : null,
              `Actualizado ${timeAgo(resource.updated_at, now)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => share(resource)}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white/85 hover:bg-white/15 hover:text-white"
        >
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Compartir</span>
        </button>
        <button
          type="button"
          onClick={() => download(resource)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-stone-900 hover:bg-stone-200"
        >
          {kind === "link" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
          <span className="hidden sm:inline">{kind === "link" ? "Abrir" : "Descargar"}</span>
        </button>
        {canFullscreen && (
          <span className="hidden sm:block">
            <IconButton
              label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              tone="dark"
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </IconButton>
          </span>
        )}
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
        onTouchEnd={(event) => {
          if (touchX.current == null || kind !== "image") return;
          const deltaX = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(deltaX) > 60) go(deltaX < 0 ? 1 : -1);
        }}
      >
        <Stage key={`${resource.id}:${resource.storage_path ?? resource.external_url}`} resource={resource} />

        {items.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 sm:left-4"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 sm:right-4"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && <Filmstrip items={items} currentId={resource.id} onPick={onNavigate} />}
    </div>
  );
}

function Filmstrip({
  items,
  currentId,
  onPick,
}: {
  items: Resource[];
  currentId: string;
  onPick: (id: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentId]);

  const index = items.findIndex((resource) => resource.id === currentId);
  const from = Math.max(0, index - 30);
  const visible = items.slice(from, index + 31);

  return (
    <div className="flex items-center gap-3 px-3 py-2 [@media(max-height:520px)]:hidden">
      <span className="shrink-0 text-xs text-stone-400 tabular-nums">
        {index + 1} / {items.length}
      </span>
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
        {visible.map((resource) => (
          <button
            key={resource.id}
            ref={resource.id === currentId ? activeRef : undefined}
            type="button"
            onClick={() => onPick(resource.id)}
            aria-label={resource.name}
            aria-current={resource.id === currentId}
            className={cx(
              "size-12 shrink-0 overflow-hidden rounded-md transition",
              resource.id === currentId ? "ring-2 ring-white" : "opacity-50 hover:opacity-100",
            )}
          >
            <ResourceThumb resource={resource} compact className="size-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Stage({ resource }: { resource: Resource }) {
  const { download } = useResourceActions();
  const kind = fileKind(resource);
  const url = useSignedUrl(resource.kind === "file" ? resource.storage_path : null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const fallback = (text: string, action?: ReactNode) => (
    <div className="flex max-w-sm flex-col items-center px-6 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/10">
        <KindIcon resource={resource} className="size-8" />
      </div>
      <p className="text-sm font-medium">{resource.name}</p>
      <p className="mt-1 text-sm text-stone-400">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
    </div>
  );

  const actionClass =
    "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-200";
  const downloadButton = (
    <button type="button" className={actionClass} onClick={() => download(resource)}>
      <Download className="size-4" /> Descargar
    </button>
  );

  if (kind === "link") {
    const embed = embedUrl(resource.external_url);
    if (embed) {
      return (
        <iframe
          src={embed}
          title={resource.name}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen; xr-spatial-tracking"
          allowFullScreen
          className="size-full max-w-6xl border-0 sm:p-4"
        />
      );
    }
    return fallback(
      `Enlace externo · ${hostOf(resource.external_url)}`,
      <a href={resource.external_url ?? "#"} target="_blank" rel="noopener noreferrer" className={actionClass}>
        <ExternalLink className="size-4" /> Abrir enlace
      </a>,
    );
  }

  if (failed) return fallback("No se pudo mostrar la vista previa de este archivo.", downloadButton);
  if (kind === "document") {
    return fallback("Este formato no tiene vista previa. Descárgalo para abrirlo.", downloadButton);
  }
  if (!url) return <Spinner className="size-7 text-white/60" />;

  if (kind === "image") {
    return (
      <>
        {!loaded && <Spinner className="absolute size-7 text-white/60" />}
        <img
          src={url}
          alt={resource.name}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cx(
            "max-h-full max-w-full object-contain transition-opacity duration-200 select-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      </>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        autoPlay
        onError={() => setFailed(true)}
        className="max-h-full max-w-full bg-black"
      />
    );
  }

  if (kind === "audio") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-5 px-6">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
          <KindIcon resource={resource} className="size-8" />
        </div>
        <audio src={url} controls className="w-full" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <PdfView
      url={url}
      title={resource.name}
      dark
      className="size-full border-0 bg-white"
      extra={
        <button
          type="button"
          onClick={() => download(resource)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20"
        >
          <Download className="size-4" /> Descargar
        </button>
      }
    />
  );
}
