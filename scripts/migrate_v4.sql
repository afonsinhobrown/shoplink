-- =========================================================
-- MIGRAÇÃO v4 — LICENÇAS / ASSINATURA (ShopLink)
-- Licença mensal por loja (2.500,00 MZN), paga via NetShop
-- cartão (BCI / BIM). Ao pagar: +30 dias contados da data_fim
-- se ativa, ou do dia do pagamento se expirada.
-- =========================================================

CREATE TABLE IF NOT EXISTS licenca (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    estado          varchar(20) NOT NULL DEFAULT 'ativa'
                    CHECK (estado IN ('ativa','expirada','bloqueada')),
    plano           varchar(20) NOT NULL DEFAULT 'mensal',
    valor_mensal    numeric(12,2) NOT NULL DEFAULT 2500,
    data_inicio     timestamptz,
    data_fim        timestamptz,
    criada_em       timestamptz NOT NULL DEFAULT now(),
    atualizada_em   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_licenca_loja ON licenca(loja_id);

CREATE TABLE IF NOT EXISTS licenca_pagamento (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    licenca_id           uuid NOT NULL REFERENCES licenca(id) ON DELETE CASCADE,
    loja_id              uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    metodo               varchar(10) NOT NULL CHECK (metodo IN ('bci','bim','manual')),
    valor                numeric(12,2) NOT NULL DEFAULT 2500,
    referencia_pagamento varchar(120),
    cobranca_id          varchar(120),
    checkout_url         varchar(500),
    status               varchar(20) NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente','pago','falhou','reembolsado')),
    periodo_inicio       timestamptz,
    periodo_fim          timestamptz,
    recibo_numero        varchar(30),
    recibo_enviado       boolean NOT NULL DEFAULT false,
    data_envio_recibo    timestamptz,
    observacao           varchar(255),
    data_pagamento       timestamptz,
    data_criacao         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_licenca_pag_ref ON licenca_pagamento(referencia_pagamento) WHERE referencia_pagamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenca_pag_loja ON licenca_pagamento(loja_id, data_criacao);

-- Seed: cada loja existente recebe licença (período de avaliação +30 dias).
INSERT INTO licenca (loja_id, estado, plano, valor_mensal, data_inicio, data_fim)
SELECT l.id, 'ativa', 'mensal', 2500, now(),
       CASE WHEN l.data_criacao > now() - interval '30 days' THEN l.data_criacao + interval '30 days'
            ELSE now() + interval '30 days' END
FROM loja l
WHERE l.ativo = true
  AND NOT EXISTS (SELECT 1 FROM licenca lc WHERE lc.loja_id = l.id);