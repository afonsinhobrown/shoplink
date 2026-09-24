-- ============================================================
-- ShopLink v2 - migracao idempotente
-- (loja online / pedidos / reservas + gestao financeira + compras)
-- Executar:  node scripts/run_migrate.mjs
-- ============================================================

-- LOJA: flags de venda/reserva online
ALTER TABLE loja ADD COLUMN IF NOT EXISTS permite_venda_online boolean NOT NULL DEFAULT false;
ALTER TABLE loja ADD COLUMN IF NOT EXISTS permite_reserva boolean NOT NULL DEFAULT false;
ALTER TABLE loja ADD COLUMN IF NOT EXISTS slug_publico varchar(80);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS tempo_expiracao_reserva_horas integer NOT NULL DEFAULT 24;
CREATE UNIQUE INDEX IF NOT EXISTS uq_loja_slug_publico ON loja(slug_publico) WHERE slug_publico IS NOT NULL;

-- CATEGORIA: subcategorias
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS categoria_pai_id uuid REFERENCES categoria(id);

-- PRODUTO: venda online
ALTER TABLE produto ADD COLUMN IF NOT EXISTS disponivel_online boolean NOT NULL DEFAULT false;
ALTER TABLE produto ADD COLUMN IF NOT EXISTS descricao_publica text;

-- COMPRAS (antes de conta_pagar, que referencia compra)
CREATE TABLE IF NOT EXISTS compra (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    fornecedor_id   uuid REFERENCES fornecedor(id),
    utilizador_id   uuid REFERENCES utilizador(id),
    total           numeric(12,2) NOT NULL DEFAULT 0,
    status          varchar(20) NOT NULL DEFAULT 'recebida'
                    CHECK (status IN ('pendente','recebida','cancelada')),
    data_compra     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compra_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id       uuid NOT NULL REFERENCES compra(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    quantidade      numeric(12,3) NOT NULL,
    custo_unitario  numeric(12,2) NOT NULL
);

-- GESTAO FINANCEIRA - CONTAS / CATEGORIAS / CENTROS
CREATE TABLE IF NOT EXISTS conta_financeira (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL,
    tipo            varchar(20) NOT NULL
                    CHECK (tipo IN ('caixa','banco','mpesa','emola','outro')),
    numero_conta    varchar(50),
    saldo_inicial   numeric(14,2) NOT NULL DEFAULT 0,
    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categoria_financeira (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL,
    tipo            varchar(10) NOT NULL
                    CHECK (tipo IN ('receita','despesa')),
    categoria_pai_id uuid REFERENCES categoria_financeira(id),
    ordem           integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS centro_custo (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lancamento_financeiro (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id             uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    conta_financeira_id uuid NOT NULL REFERENCES conta_financeira(id),
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    centro_custo_id     uuid REFERENCES centro_custo(id),
    tipo                varchar(10) NOT NULL
                        CHECK (tipo IN ('receita','despesa','transferencia')),
    valor               numeric(14,2) NOT NULL,
    descricao           varchar(255),
    origem_tipo         varchar(20)
                        CHECK (origem_tipo IN ('venda','compra','conta_pagar','conta_receber','manual','transferencia')),
    origem_id           uuid,
    status              varchar(20) NOT NULL DEFAULT 'confirmado'
                        CHECK (status IN ('confirmado','pendente','cancelado')),
    utilizador_id       uuid REFERENCES utilizador(id),
    data_lancamento     timestamptz NOT NULL DEFAULT now(),
    data_competencia    date NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_lanc_fin_loja_data ON lancamento_financeiro(loja_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lanc_fin_conta ON lancamento_financeiro(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_lanc_fin_categoria ON lancamento_financeiro(categoria_financeira_id);
CREATE INDEX IF NOT EXISTS idx_lanc_fin_competencia ON lancamento_financeiro(loja_id, data_competencia);

-- Ligacoes financeiras nas tabelas existentes
ALTER TABLE caixa_sessao ADD COLUMN IF NOT EXISTS conta_financeira_id uuid REFERENCES conta_financeira(id);
ALTER TABLE venda_pagamento ADD COLUMN IF NOT EXISTS conta_financeira_id uuid REFERENCES conta_financeira(id);
ALTER TABLE venda_item ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES lote_stock(id);

-- CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS conta_pagar (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id                 uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    fornecedor_id           uuid REFERENCES fornecedor(id),
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    compra_id               uuid REFERENCES compra(id),
    descricao               varchar(255) NOT NULL,
    valor_total             numeric(14,2) NOT NULL,
    numero_parcelas         integer NOT NULL DEFAULT 1,
    data_emissao            date NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento         date NOT NULL,
    status                  varchar(20) NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','pago_parcial','pago','atrasado','cancelado')),
    data_criacao            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conta_pagar_parcela (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_pagar_id          uuid NOT NULL REFERENCES conta_pagar(id) ON DELETE CASCADE,
    numero_parcela          integer NOT NULL,
    valor                   numeric(14,2) NOT NULL,
    data_vencimento         date NOT NULL,
    data_pagamento          date,
    lancamento_financeiro_id uuid REFERENCES lancamento_financeiro(id),
    status                  varchar(20) NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','pago','atrasado','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja_status ON conta_pagar(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_parcela_venc ON conta_pagar_parcela(data_vencimento) WHERE status = 'pendente';

-- CONTAS A RECEBER
CREATE TABLE IF NOT EXISTS conta_receber (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id             uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_id          uuid NOT NULL REFERENCES cliente(id),
    venda_id            uuid REFERENCES venda(id),
    descricao           varchar(255),
    valor_total         numeric(14,2) NOT NULL,
    data_emissao        date NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento     date NOT NULL,
    status              varchar(20) NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','recebido_parcial','recebido','atrasado','cancelado')),
    data_criacao        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conta_receber_parcela (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_receber_id        uuid NOT NULL REFERENCES conta_receber(id) ON DELETE CASCADE,
    numero_parcela          integer NOT NULL,
    valor                   numeric(14,2) NOT NULL,
    data_vencimento         date NOT NULL,
    data_recebimento        date,
    lancamento_financeiro_id uuid REFERENCES lancamento_financeiro(id),
    status                  varchar(20) NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','recebido','atrasado','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_conta_receber_loja_status ON conta_receber(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_conta_receber_parcela_venc ON conta_receber_parcela(data_vencimento) WHERE status = 'pendente';

-- TRANSFERENCIAS ENTRE CONTAS
CREATE TABLE IF NOT EXISTS transferencia_financeira (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id             uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    conta_origem_id     uuid NOT NULL REFERENCES conta_financeira(id),
    conta_destino_id    uuid NOT NULL REFERENCES conta_financeira(id),
    valor               numeric(14,2) NOT NULL,
    observacao          text,
    utilizador_id       uuid REFERENCES utilizador(id),
    data_transferencia  timestamptz NOT NULL DEFAULT now(),
    CHECK (conta_origem_id <> conta_destino_id)
);

-- DESPESAS RECORRENTES
CREATE TABLE IF NOT EXISTS despesa_recorrente (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id                 uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    fornecedor_id           uuid REFERENCES fornecedor(id),
    descricao               varchar(255) NOT NULL,
    valor                   numeric(14,2) NOT NULL,
    dia_vencimento          integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
    ativo                   boolean NOT NULL DEFAULT true,
    data_inicio             date NOT NULL DEFAULT CURRENT_DATE,
    data_fim                date
);

-- IMAGENS DO PRODUTO (Cloudinary)
CREATE TABLE IF NOT EXISTS produto_imagem (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id              uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    cloudinary_public_id    varchar(255) NOT NULL,
    url                     varchar(500) NOT NULL,
    url_thumbnail           varchar(500),
    principal               boolean NOT NULL DEFAULT false,
    ordem                   integer NOT NULL DEFAULT 0,
    largura                 integer,
    altura                  integer,
    formato                 varchar(10),
    data_upload             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produto_imagem_produto ON produto_imagem(produto_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_imagem_principal
    ON produto_imagem(produto_id) WHERE principal = true;

-- CLIENTES ONLINE / PEDIDOS / RESERVAS
CREATE TABLE IF NOT EXISTS cliente_online (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_id      uuid REFERENCES cliente(id),
    nome            varchar(150) NOT NULL,
    telefone        varchar(30) NOT NULL,
    email           varchar(150),
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_online (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id             uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_online_id   uuid NOT NULL REFERENCES cliente_online(id),
    numero_pedido       varchar(30) NOT NULL,
    tipo                varchar(20) NOT NULL
                        CHECK (tipo IN ('reserva','compra_online')),
    metodo_pagamento    varchar(20)
                        CHECK (metodo_pagamento IN ('mpesa','emola','cartao','na_loja')),
    status_pagamento    varchar(20) NOT NULL DEFAULT 'pendente'
                        CHECK (status_pagamento IN ('pendente','pago','falhou','reembolsado')),
    tipo_entrega        varchar(20) NOT NULL DEFAULT 'levantamento'
                        CHECK (tipo_entrega IN ('levantamento','entrega_domicilio')),
    endereco_entrega    text,
    subtotal            numeric(12,2) NOT NULL DEFAULT 0,
    total               numeric(12,2) NOT NULL DEFAULT 0,
    status              varchar(20) NOT NULL DEFAULT 'aguardando_confirmacao'
                        CHECK (status IN ('aguardando_confirmacao','confirmado','pronto_levantamento','concluido','expirado','cancelado')),
    venda_id            uuid REFERENCES venda(id),
    data_expiracao      timestamptz,
    data_criacao        timestamptz NOT NULL DEFAULT now(),
    data_atualizacao    timestamptz NOT NULL DEFAULT now(),
    UNIQUE(loja_id, numero_pedido)
);

-- Extensao é a cobranca NetShop (charge id) e a referencia de pagamento
ALTER TABLE pedido_online ADD COLUMN IF NOT EXISTS cobranca_id varchar(120);
ALTER TABLE pedido_online ADD COLUMN IF NOT EXISTS referencia_pagamento varchar(120);

-- 'aguardando_confirmacao' tem 22 caracteres (nao cabe em varchar(20)).
-- A view depende da coluna, por isso removemos e recriamos mais abaixo.
DROP VIEW IF EXISTS vw_stock_disponivel;
ALTER TABLE pedido_online ALTER COLUMN status TYPE varchar(30);

CREATE INDEX IF NOT EXISTS idx_pedido_online_loja_status ON pedido_online(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_pedido_online_expiracao ON pedido_online(data_expiracao) WHERE status = 'aguardando_confirmacao';
CREATE INDEX IF NOT EXISTS idx_pedido_online_ref ON pedido_online(referencia_pagamento) WHERE referencia_pagamento IS NOT NULL;

CREATE TABLE IF NOT EXISTS pedido_online_item (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_online_id    uuid NOT NULL REFERENCES pedido_online(id) ON DELETE CASCADE,
    produto_id          uuid NOT NULL REFERENCES produto(id),
    quantidade          numeric(12,3) NOT NULL,
    preco_unitario      numeric(12,2) NOT NULL,
    subtotal_linha      numeric(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_reserva (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id          uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    pedido_online_id    uuid NOT NULL REFERENCES pedido_online(id) ON DELETE CASCADE,
    quantidade          numeric(12,3) NOT NULL,
    data_criacao        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reserva_produto ON stock_reserva(produto_id);
CREATE INDEX IF NOT EXISTS idx_stock_reserva_pedido ON stock_reserva(pedido_online_id);

-- VIEWS
CREATE OR REPLACE VIEW vw_stock_disponivel AS
SELECT
    s.produto_id,
    s.loja_id,
    s.nome,
    s.quantidade_atual,
    COALESCE(r.quantidade_reservada, 0) AS quantidade_reservada,
    s.quantidade_atual - COALESCE(r.quantidade_reservada, 0) AS quantidade_disponivel
FROM vw_stock_atual s
LEFT JOIN (
    SELECT sr.produto_id, SUM(sr.quantidade) AS quantidade_reservada
    FROM stock_reserva sr
    JOIN pedido_online po ON po.id = sr.pedido_online_id
    WHERE po.status IN ('aguardando_confirmacao','confirmado')
    GROUP BY sr.produto_id
) r ON r.produto_id = s.produto_id;

CREATE OR REPLACE VIEW vw_saldo_contas AS
SELECT
    c.id AS conta_financeira_id,
    c.loja_id,
    c.nome,
    c.saldo_inicial
    + COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor
                         WHEN l.tipo = 'despesa' THEN -l.valor
                         ELSE 0 END), 0)
    + COALESCE((SELECT SUM(t.valor) FROM transferencia_financeira t WHERE t.conta_destino_id = c.id), 0)
    - COALESCE((SELECT SUM(t.valor) FROM transferencia_financeira t WHERE t.conta_origem_id = c.id), 0)
    AS saldo_atual
FROM conta_financeira c
LEFT JOIN lancamento_financeiro l
    ON l.conta_financeira_id = c.id AND l.status = 'confirmado'
GROUP BY c.id, c.loja_id, c.nome, c.saldo_inicial;

CREATE OR REPLACE VIEW vw_dre_mensal AS
SELECT
    l.loja_id,
    date_trunc('month', l.data_competencia)::date AS mes_referencia,
    cf.tipo AS tipo_categoria,
    cf.nome AS categoria,
    SUM(l.valor) AS total
FROM lancamento_financeiro l
JOIN categoria_financeira cf ON cf.id = l.categoria_financeira_id
WHERE l.status = 'confirmado'
GROUP BY l.loja_id, date_trunc('month', l.data_competencia), cf.tipo, cf.nome;

CREATE OR REPLACE VIEW vw_fluxo_caixa_previsto AS
SELECT cp.loja_id, 'a_pagar' AS tipo, pp.data_vencimento, pp.valor AS valor_previsto
FROM conta_pagar_parcela pp
JOIN conta_pagar cp ON cp.id = pp.conta_pagar_id
WHERE pp.status = 'pendente'
UNION ALL
SELECT cr.loja_id, 'a_receber' AS tipo, rp.data_vencimento, rp.valor AS valor_previsto
FROM conta_receber_parcela rp
JOIN conta_receber cr ON cr.id = rp.conta_receber_id
WHERE rp.status = 'pendente';

-- ================================
-- SEED: loja demo ativada para online
-- ================================
UPDATE loja
SET slug_publico = 'mercearia-central',
    permite_venda_online = true,
    permite_reserva = true
WHERE slug_publico IS NULL
  AND id = (SELECT ul.loja_id
            FROM utilizador_loja ul
            JOIN utilizador u ON u.id = ul.utilizador_id
            WHERE lower(u.email) = 'dono@demo.shop'
            LIMIT 1);

UPDATE produto
SET disponivel_online = true,
    descricao_publica = 'Disponível para compra ou reserva online.'
WHERE ativo = true
  AND disponivel_online = false
  AND loja_id = (SELECT l.id
                 FROM loja l
                 JOIN utilizador_loja ul ON ul.loja_id = l.id
                 JOIN utilizador u ON u.id = ul.utilizador_id
                 WHERE lower(u.email) = 'dono@demo.shop'
                 LIMIT 1)
  AND (SELECT COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
                                WHEN m.tipo = 'devolucao' THEN m.quantidade
                                WHEN m.tipo IN ('saida_venda','quebra') THEN -m.quantidade
                                WHEN m.tipo = 'ajuste' THEN m.quantidade END), 0)
       FROM movimento_stock m
       WHERE m.produto_id = produto.id) > 0;

INSERT INTO conta_financeira (loja_id, nome, tipo, numero_conta)
SELECT l.id, 'Caixa da Loja', 'caixa', NULL
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM conta_financeira cf WHERE cf.loja_id = l.id AND cf.tipo = 'caixa');

INSERT INTO conta_financeira (loja_id, nome, tipo, numero_conta)
SELECT l.id, 'M-Pesa Comercial', 'mpesa', NULL
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM conta_financeira cf WHERE cf.loja_id = l.id AND cf.tipo = 'mpesa');

INSERT INTO conta_financeira (loja_id, nome, tipo, numero_conta)
SELECT l.id, 'e-Mola Comercial', 'emola', NULL
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM conta_financeira cf WHERE cf.loja_id = l.id AND cf.tipo = 'emola');

INSERT INTO conta_financeira (loja_id, nome, tipo, numero_conta)
SELECT l.id, 'Conta Banco BIM', 'banco', NULL
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM conta_financeira cf WHERE cf.loja_id = l.id AND cf.tipo = 'banco');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Vendas', 'receita', 1
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Vendas');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Outras Receitas', 'receita', 2
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Outras Receitas');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Custo de Mercadorias', 'despesa', 1
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Custo de Mercadorias');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Fornecedores', 'despesa', 2
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Fornecedores');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Renda e Serviços', 'despesa', 3
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Renda e Serviços');

INSERT INTO categoria_financeira (loja_id, nome, tipo, ordem)
SELECT l.id, 'Salários', 'despesa', 4
FROM loja l
JOIN utilizador_loja ul ON ul.loja_id = l.id
JOIN utilizador u ON u.id = ul.utilizador_id
WHERE lower(u.email) = 'dono@demo.shop'
  AND NOT EXISTS (SELECT 1 FROM categoria_financeira cf WHERE cf.loja_id = l.id AND cf.nome = 'Salários');

UPDATE caixa_sessao cs
SET conta_financeira_id = (SELECT id FROM conta_financeira WHERE loja_id = cs.loja_id AND tipo = 'caixa' LIMIT 1)
WHERE cs.conta_financeira_id IS NULL;