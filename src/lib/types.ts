export type Role = "admin" | "comercial";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_shared: boolean;
  active: boolean;
  created_at: string;
}

export type ProjectStatus = "preventa" | "en_construccion" | "entrega_inmediata" | "finalizado";

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  status: ProjectStatus;
  commercial_info: string;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  last_activity_at: string;
}

export interface Typology {
  id: string;
  project_id: string;
  name: string;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export type CategoryKey =
  | "brochures"
  | "planos"
  | "videos"
  | "fotografias"
  | "fichas_tecnicas"
  | "listas_precios"
  | "material_publicitario"
  | "otros"
  | "departamentos_atipicos_renders"
  | "departamentos_atipicos_tipologias"
  | "departamentos_atipicos_vistas_360"
  | "departamentos_tipicos_renders"
  | "departamentos_tipicos_tipologias"
  | "departamentos_tipicos_vistas_360";

export type CategoryGroupKey = "departamentos" | "departamentos_atipicos" | "departamentos_tipicos";

export interface Resource {
  id: string;
  project_id: string;
  typology_id: string | null;
  category: CategoryKey;
  name: string;
  kind: "file" | "link";
  storage_path: string | null;
  thumb_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  extension: string | null;
  size_bytes: number | null;
  external_url: string | null;
  version: number;
  share_token: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ActivityEntry {
  id: number;
  action: "created" | "updated" | "replaced" | "deleted";
  entity_type: "project" | "typology" | "resource" | "user";
  entity_id: string | null;
  entity_name: string;
  project_id: string | null;
  project_name: string | null;
  user_id: string | null;
  user_name: string;
  details: string | null;
  created_at: string;
}
