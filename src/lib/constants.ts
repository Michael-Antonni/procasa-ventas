import type { CategoryGroupKey, CategoryKey, ProjectStatus } from "./types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Biblioteca Comercial";
export const BUCKET = "materiales";

/** Un material se marca como "Nuevo" o "Actualizado" durante estos días. */
export const RECENT_DAYS = 3;

export const CATEGORY_TREE = {
  key: "departamentos",
  label: "Departamentos",
  groups: [
    {
      key: "departamentos_atipicos",
      label: "Departamento atípico",
      categories: [
        { key: "departamentos_atipicos_renders", label: "Renders" },
        { key: "departamentos_atipicos_tipologias", label: "Tipologías del departamento" },
        { key: "departamentos_atipicos_vistas_360", label: "Vistas 360" },
      ],
    },
    {
      key: "departamentos_tipicos",
      label: "Departamento típico",
      categories: [
        { key: "departamentos_tipicos_renders", label: "Renders" },
        { key: "departamentos_tipicos_tipologias", label: "Tipologías del departamento" },
        { key: "departamentos_tipicos_vistas_360", label: "Vistas 360" },
      ],
    },
  ],
} as const satisfies {
  key: CategoryGroupKey;
  label: string;
  groups: readonly {
    key: CategoryGroupKey;
    label: string;
    categories: readonly { key: CategoryKey; label: string }[];
  }[];
};

export const CATEGORIES: { key: CategoryKey; label: string; short: string }[] = [
  { key: "brochures", label: "Brochures", short: "Brochure" },
  { key: "planos", label: "Planos arquitectónicos", short: "Plano" },
  { key: "videos", label: "Videos y recorridos", short: "Video" },
  { key: "fotografias", label: "Fotografías", short: "Fotografía" },
  { key: "fichas_tecnicas", label: "Fichas técnicas", short: "Ficha técnica" },
  { key: "listas_precios", label: "Listas de precios", short: "Lista de precios" },
  { key: "material_publicitario", label: "Material publicitario", short: "Publicidad" },
  { key: "otros", label: "Otros documentos", short: "Documento" },
  ...CATEGORY_TREE.groups.flatMap((group) =>
    group.categories.map((category) => ({
      key: category.key,
      label: `${group.label} · ${category.label}`,
      short: `${group.label.replace("Departamento ", "")} · ${category.label}`,
    })),
  ),
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<
  CategoryKey,
  string
>;
export const CATEGORY_SHORT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.short])) as Record<
  CategoryKey,
  string
>;

export const STATUSES: { key: ProjectStatus; label: string; className: string }[] = [
  { key: "preventa", label: "Preventa", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  { key: "en_construccion", label: "En construcción", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  {
    key: "entrega_inmediata",
    label: "Entrega inmediata",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  { key: "finalizado", label: "Finalizado", className: "bg-stone-100 text-stone-700 ring-stone-200" },
];

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<
  ProjectStatus,
  (typeof STATUSES)[number]
>;

export const FILE_TYPES = [
  { key: "image", label: "Imágenes" },
  { key: "pdf", label: "PDF" },
  { key: "video", label: "Videos" },
  { key: "document", label: "Documentos" },
  { key: "link", label: "Enlaces" },
] as const;
