import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authErrorMessage, logUserActivity, requireAdmin } from "@/lib/supabase/admin-guard";
import type { Profile } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function otherActiveAdmins(admin: SupabaseClient, exceptId: string): Promise<number> {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true)
    .neq("id", exceptId);
  return count ?? 0;
}

export async function PATCH(request: Request, { params }: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
  const body = await request.json().catch(() => null);

  const { data: current } = await guard.admin.from("profiles").select("*").eq("id", id).maybeSingle();
  const target = current as Profile | null;
  if (!target) return NextResponse.json({ error: "El usuario ya no existe." }, { status: 404 });

  const role = body?.role === "admin" || body?.role === "comercial" ? (body.role as Profile["role"]) : target.role;
  const active = typeof body?.active === "boolean" ? body.active : target.active;
  const fullName = typeof body?.full_name === "string" && body.full_name.trim() ? body.full_name.trim() : target.full_name;
  const isShared = role === "comercial" && (typeof body?.is_shared === "boolean" ? body.is_shared : target.is_shared);
  const password = typeof body?.password === "string" ? body.password : "";

  const losesAdmin = target.role === "admin" && target.active && (role !== "admin" || !active);
  if (losesAdmin && id === guard.me.id) {
    return NextResponse.json(
      { error: "No puedes quitarte a ti mismo el acceso de administrador." },
      { status: 400 },
    );
  }
  if (losesAdmin && (await otherActiveAdmins(guard.admin, id)) === 0) {
    return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const { error: authError } = await guard.admin.auth.admin.updateUserById(id, {
    ...(password ? { password } : {}),
    user_metadata: { full_name: fullName },
  });
  if (authError) return NextResponse.json({ error: authErrorMessage(authError.message) }, { status: 400 });

  const { data: updated, error } = await guard.admin
    .from("profiles")
    .update({ full_name: fullName, role, is_shared: isShared, active })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changes = [
    role !== target.role && `Rol: ${target.role} → ${role}`,
    active !== target.active && (active ? "Cuenta activada" : "Cuenta desactivada"),
    password && "Contraseña cambiada",
    fullName !== target.full_name && `Nombre anterior: ${target.full_name}`,
  ].filter(Boolean);
  await logUserActivity(guard.admin, guard.me, "updated", { id, name: fullName }, changes.join(" · ") || undefined);

  return NextResponse.json({ user: updated });
}

export async function DELETE(_request: Request, { params }: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
  if (id === guard.me.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  }

  const { data: current } = await guard.admin.from("profiles").select("*").eq("id", id).maybeSingle();
  const target = current as Profile | null;
  if (target?.role === "admin" && target.active && (await otherActiveAdmins(guard.admin, id)) === 0) {
    return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 400 });
  }

  const { error } = await guard.admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: authErrorMessage(error.message) }, { status: 400 });
  await logUserActivity(guard.admin, guard.me, "deleted", {
    id,
    name: target?.full_name || target?.email || "Usuario",
  });
  return NextResponse.json({ ok: true });
}
