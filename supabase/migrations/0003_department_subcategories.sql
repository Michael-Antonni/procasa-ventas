alter table public.resources
  drop constraint if exists resources_category_check;

alter table public.resources
  add constraint resources_category_check check (
    category in (
      'brochures', 'planos', 'videos', 'fotografias', 'fichas_tecnicas',
      'listas_precios', 'material_publicitario', 'otros',
      'departamentos_atipicos_renders', 'departamentos_atipicos_tipologias',
      'departamentos_atipicos_vistas_360', 'departamentos_tipicos_renders',
      'departamentos_tipicos_tipologias', 'departamentos_tipicos_vistas_360'
    )
  );
