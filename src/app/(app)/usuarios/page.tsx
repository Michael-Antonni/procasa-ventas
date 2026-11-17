"use client";

import { KeyRound, Lock, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-bits";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  inputClass,
  Modal,
  Spinner,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Profile, Role } from "@/lib/types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo completar la operación.");
  return json as T;
}

export default function UsersPage() {
  const { isAdmin, profile } = useData();
  const toast = useToast();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ user?: Profile } | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    try {
      const { users: list } = await api<{ users: Profile[] }>("/api/admin/users");
      setUsers(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista de usuarios.");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga desde el servidor
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Lock className="size-6" />}
        title="Sección solo para administradores"
        text="La gestión de usuarios está disponible únicamente para administradores."
      />
    );
  }

  const hasShared = users?.some((u) => u.is_shared && u.active);

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas con acceso a la biblioteca."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({})}>
            Nuevo usuario
          </Button>
        }
      />

      <div className="mb-5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200 ring-inset">
        <p className="font-medium">¿Cómo ingresa el equipo de ventas?</p>
        <p className="mt-1 text-brand-800">
          {hasShared
            ? "Ya existe una cuenta compartida: todos los asesores pueden ingresar con ese mismo correo y contraseña."
            : "Crea un usuario comercial marcado como “cuenta compartida” y entrega ese correo y contraseña a todos los asesores."}{" "}
          Cuando lo necesites, puedes crear además usuarios individuales. Las cuentas comerciales solo pueden ver,
          descargar y compartir; nunca modificar.
        </p>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {!users ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : users.length === 0 ? (
        !error && <EmptyState icon={<Users className="size-6" />} title="Sin usuarios" />
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl bg-white shadow-sm ring-1 ring-stone-200/80">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                {u.is_shared ? <Users className="size-5" /> : <UserRound className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium text-stone-900">{u.full_name || u.email}</span>
                  {u.role === "admin" ? (
                    <Badge className="bg-stone-900 text-white ring-stone-900">Administrador</Badge>
                  ) : (
                    <Badge>{u.is_shared ? "Comercial · compartida" : "Comercial"}</Badge>
                  )}
                  {!u.active && <Badge className="bg-red-50 text-red-700 ring-red-200">Sin acceso</Badge>}
                  {u.id === profile.id && <span className="text-xs text-stone-400">(tú)</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {u.email} · desde {formatDate(u.created_at)}
                </p>
              </div>
              <IconButton label="Editar usuario" onClick={() => setForm({ user: u })}>
                <Pencil className="size-4" />
              </IconButton>
              <IconButton
                label="Eliminar usuario"
                disabled={u.id === profile.id}
                onClick={() => setDeleting(u)}
                className="hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <UserFormDialog
          user={form.user}
          isSelf={form.user?.id === profile.id}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => {
            setUsers((list) =>
              created ? [...(list ?? []), saved] : (list ?? []).map((u) => (u.id === saved.id ? saved : u)),
            );
            toast({ title: created ? "Usuario creado" : "Usuario actualizado" });
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Eliminar usuario"
        text={`"${deleting?.full_name || deleting?.email || ""}" perderá el acceso de inmediato. El historial de sus modificaciones se conserva.`}
        onConfirm={async () => {
          if (!deleting) return;
          await api(`/api/admin/users/${deleting.id}`, { method: "DELETE" });
          setUsers((list) => (list ?? []).filter((u) => u.id !== deleting.id));
          toast({ title: "Usuario eliminado" });
        }}
      />
    </>
  );
}

function UserFormDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user?: Profile;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: Profile, created: boolean) => void;
}) {
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "comercial");
  const [isShared, setIsShared] = useState(user?.is_shared ?? false);
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({
        full_name: fullName,
        email,
        role,
        is_shared: isShared,
        active,
        ...(password ? { password } : {}),
      });
      const { user: saved } = user
        ? await api<{ user: Profile }>(`/api/admin/users/${user.id}`, { method: "PATCH", body })
        : await api<{ user: Profile }>("/api/admin/users", { method: "POST", body });
      onSaved(saved, !user);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusy(false);
    }
  };

  const check = "size-4 rounded border-stone-300 accent-brand-600";

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      title={user ? "Editar usuario" : "Nuevo usuario"}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {user ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nombre" hint="Para una cuenta compartida usa algo como “Equipo de ventas”.">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Correo de acceso">
          <input
            className={inputClass}
            type="email"
            value={email}
            disabled={Boolean(user)}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ventas@tuinmobiliaria.com"
          />
        </Field>
        <Field
          label={user ? "Nueva contraseña (opcional)" : "Contraseña"}
          hint={user ? "Déjala vacía para conservar la actual." : "Mínimo 8 caracteres."}
        >
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <input
              className={`${inputClass} pl-9`}
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </Field>
        <Field label="Nivel de acceso">
          <select
            className={inputClass}
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="comercial">Usuario comercial · ver, descargar y compartir</option>
            <option value="admin">Administrador · acceso completo</option>
          </select>
        </Field>
        {role === "comercial" && (
          <label className="flex items-start gap-3 text-sm text-stone-700">
            <input
              type="checkbox"
              className={`${check} mt-0.5`}
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            <span>
              Cuenta compartida por el equipo
              <span className="block text-xs text-stone-500">Varios asesores ingresan con este mismo usuario.</span>
            </span>
          </label>
        )}
        {user && !isSelf && (
          <label className="flex items-start gap-3 text-sm text-stone-700">
            <input
              type="checkbox"
              className={`${check} mt-0.5`}
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>
              Cuenta activa
              <span className="block text-xs text-stone-500">Desmárcala para suspender el acceso sin eliminarla.</span>
            </span>
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}
