alter table public.resources
  drop constraint if exists resources_category_check;

alter table public.resources
  add constraint resources_category_check check (
    category in (
      'brochures', 'renders_exteriores', 'renders_interiores', 'tipologias',
      'departamentos_atipicos', 'departamentos_tipicos',
      'planos', 'videos', 'fotografias', 'fichas_tecnicas',
      'listas_precios', 'material_publicitario', 'otros'
    )
  );
