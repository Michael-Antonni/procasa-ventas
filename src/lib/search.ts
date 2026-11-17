import { CATEGORY_LABEL } from "./constants";
import { filterKind, normalize } from "./format";
import type { CategoryKey, Project, Resource, Typology } from "./types";

export interface SearchFilters {
  projectId?: string;
  category?: CategoryKey | "";
  fileType?: string;
}

export interface SearchResults {
  projects: Project[];
  typologies: Typology[];
  resources: Resource[];
}

const matches = (haystack: string, tokens: string[]) => tokens.every((t) => haystack.includes(t));

/**
 * Búsqueda en memoria: cada palabra debe aparecer en el nombre, archivo,
 * categoría, proyecto o tipología. No distingue mayúsculas ni tildes.
 */
export function search(
  query: string,
  data: { projects: Project[]; typologies: Typology[]; resources: Resource[] },
  filters: SearchFilters = {},
): SearchResults {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const projectName = new Map(data.projects.map((p) => [p.id, p.name]));
  const typologyName = new Map(data.typologies.map((t) => [t.id, t.name]));
  const filtering = Boolean(filters.category || filters.fileType);

  const resources = data.resources
    .filter((r) => {
      if (filters.projectId && r.project_id !== filters.projectId) return false;
      if (filters.category && r.category !== filters.category) return false;
      if (filters.fileType && filterKind(r) !== filters.fileType) return false;
      if (!tokens.length) return true;
      const haystack = normalize(
        [
          r.name,
          r.file_name,
          r.extension,
          CATEGORY_LABEL[r.category],
          projectName.get(r.project_id),
          r.typology_id ? typologyName.get(r.typology_id) : "",
        ].join(" "),
      );
      return matches(haystack, tokens);
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  // Los filtros de categoría y tipo de archivo solo aplican a materiales.
  if (filtering) return { projects: [], typologies: [], resources };

  const projects = tokens.length
    ? data.projects.filter(
        (p) =>
          (!filters.projectId || p.id === filters.projectId) &&
          matches(normalize(`${p.name} ${p.location} ${p.description}`), tokens),
      )
    : [];

  const typologies = tokens.length
    ? data.typologies.filter(
        (t) =>
          (!filters.projectId || t.project_id === filters.projectId) &&
          matches(
            normalize(`${t.name} ${t.description} ${projectName.get(t.project_id) ?? ""} tipologia departamento`),
            tokens,
          ),
      )
    : [];

  return { projects, typologies, resources };
}
