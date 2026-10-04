-- =========================================================
-- MIGRAÇÃO v6 — SOB ENCOMENDA / WHATSAPP
--
-- Colunas usadas por src/app/loja/[slug]/page.tsx,
-- src/app/api/publico/[slug]/produtos/route.ts e
-- src/app/api/produtos/route.ts.
--
-- IMPORTANTE: tem de ser corrida na MESMA base de dados
-- usada pelo deploy (Vercel -> DATABASE_URL). A BD de
-- desenvolvimento pode ser diferente da de produção.
-- =========================================================

ALTER TABLE produto ADD COLUMN IF NOT EXISTS sob_encomenda boolean NOT NULL DEFAULT false;
ALTER TABLE produto ADD COLUMN IF NOT EXISTS mostrar_botao_pagamento boolean NOT NULL DEFAULT true;
ALTER TABLE produto ADD COLUMN IF NOT EXISTS mostrar_botao_whatsapp boolean NOT NULL DEFAULT false;
ALTER TABLE produto ADD COLUMN IF NOT EXISTS whatsapp_numero text;

ALTER TABLE loja ADD COLUMN IF NOT EXISTS whatsapp_numero text;

UPDATE produto SET sob_encomenda = false WHERE sob_encomenda IS NULL;
UPDATE produto SET mostrar_botao_pagamento = true WHERE mostrar_botao_pagamento IS NULL;
UPDATE produto SET mostrar_botao_whatsapp = false WHERE mostrar_botao_whatsapp IS NULL;
