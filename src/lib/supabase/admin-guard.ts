import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Profile } from "../types";
import { createAdminClient, getSessionProfile } from "./server";

type Guard = { ok: true; admin: SupabaseClient; me: Profile } | { ok: false; response: NextResponse };

/** Comprueba que quien llama es un administrador activo antes de usar la clave secreta. */
export async function requireAdmin(): Promise<Guard> {
  const me = await getSessionProfile();
  if (!me) return { ok: false, response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  if (!me.active || me.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Solo un administrador puede gestionar usuarios." }, { status: 403 }),
    };
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Sin esa clave no se pueden gestionar usuarios.",
          code: "missing_service_key",
        },
        { status: 501 },
      ),
    };
  }
  return { ok: true, admin, me };
}

export async function logUserActivity(
  admin: SupabaseClient,
  me: Profile,
  action: "created" | "updated" | "deleted",
  target: { id: string; name: string },
  details?: string,
) {
  await admin.from("activity_log").insert({
    action,
    entity_type: "user",
    entity_id: target.id,
    entity_name: target.name,
    user_id: me.id,
    user_name: me.full_name || me.email,
    details: details ?? null,
  });
}

export function authErrorMessage(message: string): string {
  if (/already (been )?registered|already exists/i.test(message)) return "Ya existe un usuario con ese correo.";
  if (/password/i.test(message)) return "La contraseña debe tener al menos 8 caracteres.";
  if (/email/i.test(message)) return "El correo no es válido.";
  return message || "No se pudo completar la operación.";
}
