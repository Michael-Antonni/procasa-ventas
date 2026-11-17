/** Convierte errores de Supabase/Postgres en mensajes claros para el usuario. */
export function errorMessage(e: unknown, fallback = "Ocurrió un error. Inténtalo de nuevo."): string {
  const raw =
    typeof e === "string"
      ? e
      : e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "";
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "42501" || code === "PGRST116" || /row-level security|permission denied/i.test(raw)) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }
  if (code === "23505") return "Ya existe un registro con esos datos.";
  if (code === "23514" || code === "23502") return "Revisa los datos ingresados: hay un valor no válido.";
  return raw || fallback;
}
