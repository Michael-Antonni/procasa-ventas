import { NextResponse } from "next/server";
import { authErrorMessage, logUserActivity, requireAdmin } from "@/lib/supabase/admin-guard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.admin.from("profiles").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.full_name ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "comercial";
  const isShared = role === "comercial" && Boolean(body?.is_shared);

  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (!fullName) return NextResponse.json({ error: "Escribe un nombre para la cuenta." }, { status: 400 });

  const { data, error } = await guard.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: authErrorMessage(error?.message ?? "") }, { status: 400 });
  }

  // El trigger de la base crea el perfil inactivo; aquí se le da acceso y rol.
  const { data: profile, error: profileError } = await guard.admin
    .from("profiles")
    .update({ full_name: fullName, role, is_shared: isShared, active: true })
    .eq("id", data.user.id)
    .select()
    .single();
  if (profileError) {
    await guard.admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "No se pudo crear el perfil del usuario." }, { status: 500 });
  }

  await logUserActivity(
    guard.admin,
    guard.me,
    "created",
    { id: data.user.id, name: fullName },
    role === "admin" ? "Administrador" : isShared ? "Cuenta compartida del equipo comercial" : "Usuario comercial",
  );
  return NextResponse.json({ user: profile }, { status: 201 });
}
