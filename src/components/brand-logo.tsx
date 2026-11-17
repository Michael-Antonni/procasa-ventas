import Image from "next/image";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-procasa.png"
      alt="Procasa Constructora Inmobiliaria"
      width={768}
      height={217}
      className={className ?? "h-12 w-auto"}
    />
  );
}
