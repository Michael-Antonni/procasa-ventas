import { Images, RefreshCw, Search } from "lucide-react";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/constants";
import { isConfigured } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-lg bg-white px-2.5 py-2 shadow-sm">
            <BrandLogo className="h-10 w-auto" />
          </span>
          <span className="text-sm font-medium text-brand-100">{APP_NAME}</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Todo el material de cada proyecto, siempre en su última versión.
          </h1>
          <ul className="mt-8 space-y-4 text-[15px] text-brand-100">
            <li className="flex items-center gap-3">
              <Images className="size-5 shrink-0 text-brand-300" /> Renders, planos, brochures y videos por proyecto
            </li>
            <li className="flex items-center gap-3">
              <RefreshCw className="size-5 shrink-0 text-brand-300" /> Cambios visibles al instante para todo el equipo
            </li>
            <li className="flex items-center gap-3">
              <Search className="size-5 shrink-0 text-brand-300" /> Encuentra cualquier archivo en segundos
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-brand-300">Uso interno del equipo comercial.</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-start gap-2 lg:hidden">
            <BrandLogo className="h-12 w-auto" />
            <span className="text-sm font-medium text-stone-600">{APP_NAME}</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Ingresar</h2>
          <p className="mt-1 text-sm text-stone-500">Usa la cuenta que te entregó tu administrador.</p>

          {isConfigured ? (
            <Suspense>
              <LoginForm />
            </Suspense>
          ) : (
            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
              <p className="font-medium">Falta conectar la base de datos</p>
              <p className="mt-1">
                Define <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en{" "}
                <code className="font-mono text-xs">.env.local</code> y reinicia la aplicación. Los pasos están en el
                README.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
