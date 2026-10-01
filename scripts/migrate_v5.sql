-- =========================================================
-- MIGRAÇÃO v5 — CORREÇÕES DA INTEGRAÇÃO PAYSUITE
--
-- 1) O CHECK de licenca_pagamento.metodo só aceitava
--    ('bci','bim','manual'), mas o código inseria 'card'
--    (PaySuite devolve 'mpesa' | 'emola' | 'credit_card').
--    Todas as compras de licença rebentavam com violação
--    de CHECK. Os valores legados da NetShop ficam válidos
--    para não quebrar o histórico.
--
-- 2) metodo era varchar(10) e 'credit_card' tem 11
--    caracteres, por isso a coluna foi alargada.
-- =========================================================

ALTER TABLE licenca_pagamento ALTER COLUMN metodo TYPE varchar(20);

ALTER TABLE licenca_pagamento DROP CONSTRAINT IF EXISTS licenca_pagamento_metodo_check;

ALTER TABLE licenca_pagamento ADD CONSTRAINT licenca_pagamento_metodo_check CHECK (metodo IN ('paysuite','mpesa','emola','credit_card','bci','bim','manual'));