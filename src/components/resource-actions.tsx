"use client";

import { useCallback } from "react";
import { errorMessage } from "@/lib/errors";
import { downloadResource, shareResource } from "@/lib/files";
import type { Resource } from "@/lib/types";
import { useData } from "./data-provider";
import { useToast } from "./toast";

/** Acciones comunes sobre un material, con sus avisos. */
export function useResourceActions() {
  const toast = useToast();
  const { projectById } = useData();

  const download = useCallback(
    async (resource: Resource) => {
      try {
        await downloadResource(resource);
      } catch (error) {
        toast({ tone: "error", title: errorMessage(error) });
      }
    },
    [toast],
  );

  const share = useCallback(
    async (resource: Resource) => {
      try {
        const result = await shareResource(resource, projectById.get(resource.project_id)?.name);
        if (result === "copied") {
          toast({ title: "Enlace copiado", description: "Siempre abrirá la versión más reciente." });
        }
      } catch {
        toast({ tone: "error", title: "No se pudo copiar el enlace." });
      }
    },
    [toast, projectById],
  );

  return { download, share };
}
