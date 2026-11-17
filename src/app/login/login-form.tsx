"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          /invalid login credentials/i.test(signInError.message)
            ? "Correo o contraseña incorrectos."
            : /fetch/i.test(signInError.message)
              ? "No hay conexión con el servidor. Inténtalo de nuevo."
              : signInError.message,
        );
        setBusy(false);
        return;
      }
      // Solo se aceptan destinos internos.
      const next = params.get("next") ?? "/";
      router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label="Correo">
        <input
          className={inputClass}
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ventas@tuinmobiliaria.com"
        />
      </Field>
      <Field label="Contraseña">
        <div className="relative">
          <input
            className={`${inputClass} pr-10`}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-700"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" variant="primary" loading={busy} className="w-full">
        Ingresar
      </Button>
    </form>
  );
}
