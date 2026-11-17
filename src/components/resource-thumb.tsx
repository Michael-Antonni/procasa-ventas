"use client";

import { FileSpreadsheet, FileText, Film, Image as ImageIcon, Link2, Music, Presentation } from "lucide-react";
import { useState } from "react";
import { useSignedUrl } from "@/lib/files";
import { fileKind, formatLabel } from "@/lib/format";
import type { Resource } from "@/lib/types";
import { cx } from "./ui";

const TONES: Record<string, string> = {
  image: "bg-violet-50 text-violet-600",
  pdf: "bg-red-50 text-red-600",
  video: "bg-sky-50 text-sky-600",
  audio: "bg-amber-50 text-amber-600",
  link: "bg-brand-50 text-brand-600",
  document: "bg-stone-100 text-stone-500",
};

export function KindIcon({ resource, className }: { resource: Resource; className?: string }) {
  const kind = fileKind(resource);
  const ext = (resource.extension || "").toLowerCase();
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  if (kind === "link") return <Link2 className={className} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={className} />;
  if (["ppt", "pptx", "key"].includes(ext)) return <Presentation className={className} />;
  return <FileText className={className} />;
}

/** Miniatura de un material: la imagen si existe, o un ícono según el formato. */
export function ResourceThumb({
  resource,
  className,
  compact,
}: {
  resource: Resource;
  className?: string;
  compact?: boolean;
}) {
  const kind = fileKind(resource);
  const path = kind === "image" ? (resource.thumb_path ?? resource.storage_path) : null;
  const url = useSignedUrl(path);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url && failedUrl !== url;

  return (
    <div className={cx("relative flex items-center justify-center overflow-hidden", TONES[kind], className)}>
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedUrl(url)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : compact ? (
        <KindIcon resource={resource} className="size-[45%]" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <KindIcon resource={resource} className="size-9" />
          <span className="text-[11px] font-semibold tracking-wide opacity-80">{formatLabel(resource)}</span>
        </div>
      )}
    </div>
  );
}
