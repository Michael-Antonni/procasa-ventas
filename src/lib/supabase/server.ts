import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Profile } from "../types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = Boolean(URL && ANON);

/** Cliente de servidor con la sesión del usuario (respeta RLS). */
export async function createClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy las renueva.
        }
      },
    },
  });
}

/**
 * Cliente con la clave secreta: salta RLS. Úsalo solo en el servidor y solo
 * después de comprobar permisos. Devuelve null si la clave no está configurada.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !key) return null;
  return createPlainClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Usuario de la sesión actual con su perfil, o null si no hay sesión. */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}
