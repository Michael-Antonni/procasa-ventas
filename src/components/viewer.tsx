"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ViewerContextValue {
  /** Abre el visor en `id`; `ids` define el orden para navegar como galería. */
  open: (ids: string[], id: string) => void;
}

const ViewerContext = createContext<ViewerContextValue>({ open: () => {} });

const ResourceViewer = dynamic(() => import("./resource-viewer"), {
  loading: () => (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cargando vista previa"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950 text-white"
    >
      <span className="size-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </div>
  ),
});

export function useViewer() {
  return useContext(ViewerContext);
}

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ ids: string[]; id: string } | null>(null);
  const open = useCallback((ids: string[], id: string) => setSession({ ids, id }), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ViewerContext.Provider value={value}>
      {children}
      {session && (
        <ResourceViewer
          ids={session.ids}
          id={session.id}
          onNavigate={(id) => setSession((s) => (s ? { ...s, id } : s))}
          onClose={() => setSession(null)}
        />
      )}
    </ViewerContext.Provider>
  );
}
