const isVercelBuild = process.env.VERCEL === "1";

if (!isVercelBuild) {
  process.exit(0);
}

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());

if (missingVariables.length) {
  console.error(
    `Faltan variables para el despliegue en Vercel: ${missingVariables.join(", ")}. Configúralas en Project Settings → Environment Variables.`,
  );
  process.exit(1);
}

let supabaseUrl;
try {
  supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida.");
  process.exit(1);
}

const hostname = supabaseUrl.hostname.toLowerCase();
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost");

if (supabaseUrl.protocol !== "https:" || isLocalHost) {
  console.error("NEXT_PUBLIC_SUPABASE_URL debe apuntar por HTTPS al proyecto remoto, no a Supabase local.");
  process.exit(1);
}

console.info("Configuración de Supabase para Vercel validada.");
