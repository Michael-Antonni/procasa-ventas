"use client";

import { AlertCircle, BellRing, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastInput {
  title: string;
  description?: string;
  /** Si se indica, el aviso lleva a esa pantalla al hacer clic. */
  href?: string;
  tone?: "success" | "error" | "update";
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 8000 : t.tone === "update" ? 7000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => {
          const tone = t.tone ?? "success";
          const body = (
            <>
              <span className="mt-0.5 shrink-0">
                {tone === "error" ? (
                  <AlertCircle className="size-5 text-red-400" />
                ) : tone === "update" ? (
                  <BellRing className="size-5 text-brand-300" />
                ) : (
                  <CheckCircle2 className="size-5 text-brand-300" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.title}</span>
                {t.description && <span className="mt-0.5 block text-[13px] text-stone-300">{t.description}</span>}
              </span>
            </>
          );
          return (
            <div
              key={t.id}
              className="animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-1 rounded-xl bg-stone-900 py-3 pr-2 pl-4 text-white shadow-xl"
            >
              {t.href ? (
                <Link href={t.href} onClick={() => dismiss(t.id)} className="flex min-w-0 flex-1 items-start gap-3">
                  {body}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
              )}
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-stone-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
