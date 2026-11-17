import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { getSessionProfile, isConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured) redirect("/login");
  const profile = await getSessionProfile();

  if (!profile || !profile.active) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200">
          <h1 className="text-lg font-semibold text-stone-900">Tu cuenta no tiene acceso</h1>
          <p className="mt-2 text-sm text-stone-600">
            Esta cuenta está desactivada o pendiente de aprobación. Pide a un administrador que la active.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
