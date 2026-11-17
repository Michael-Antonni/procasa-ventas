"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "./ui";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      icon={<LogOut className="size-4" />}
      onClick={async () => {
        await getSupabase().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
