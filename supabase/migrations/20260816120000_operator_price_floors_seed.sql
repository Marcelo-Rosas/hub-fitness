-- Seed SANCO floors into Operator price_* so M14 can read price_category_items.
-- Values mirror hubParams / SANCO_VAS_FLOORS (cents). Idempotent.

INSERT INTO public.price_categories (id, price_table_kind_id, code, name)
SELECT gen_random_uuid(), k.id, v.code, v.name
FROM public.price_table_kinds k
JOIN (
  VALUES
    ('STORAGE', 'SANCO_ARM', 'Piso armazenagem SANCO'),
    ('HANDLING', 'SANCO_MOV', 'Piso handling SANCO'),
    ('HANDLING', 'SANCO_DES', 'Piso desunitização SANCO'),
    ('VAS', 'SANCO_ETI', 'Piso etiquetagem SANCO')
) AS v(kind_code, code, name) ON k.code = v.kind_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_categories pc
  WHERE pc.price_table_kind_id = k.id AND pc.code = v.code
);

INSERT INTO public.price_category_items (
  price_category_id, sku_code, description, unit, unit_price_cents, effective_from
)
SELECT pc.id, v.sku, v.descr, v.unit, v.cents, CURRENT_DATE
FROM public.price_categories pc
JOIN (
  VALUES
    ('SANCO_ARM', 'floor-arm', 'Armazenagem Posição Palete Fitness', 'posição', 2250),
    ('SANCO_MOV', 'floor-mov', 'Handling Inbound / Outbound Padrão', 'movimentação', 2500),
    ('SANCO_DES', 'floor-des', 'Desunitização & Cross-docking Container', 'contêiner', 140000),
    ('SANCO_ETI', 'floor-eti', 'Etiquetagem & Kitting B2C / B2B', 'unidade', 75)
) AS v(cat_code, sku, descr, unit, cents) ON pc.code = v.cat_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_category_items pci
  WHERE pci.price_category_id = pc.id AND pci.sku_code = v.sku
);
