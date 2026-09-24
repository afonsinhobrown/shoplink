# ShopLink — Esquema de Base de Dados
### Sistema de Gestão para Mercearias e Mini Supermercados
**TECNOINCUBADORA** | PostgreSQL (Neon) | v1.4

---

## 1. Visão Geral da Arquitetura

Modelo **multi-loja, multi-tenant lógico**, onde `loja_id` está presente em todas as tabelas transacionais. A flexibilidade mercearia ↔ mini-mercado é resolvida por **configuração**, não por schema separado.

```
tenant (dono/empresa)
  └── loja (mercearia ou mini_mercado) — tipo_loja define comportamento
        └── utilizadores, produtos, stock, vendas, caixa, fornecedores
```

---

## 2. Esquema SQL Completo

```sql
-- =========================================================
-- EXTENSÕES
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- =========================================================
-- 1. TENANT / EMPRESA (dono do negócio)
-- =========================================================
CREATE TABLE tenant (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            varchar(150) NOT NULL,
    nuit            varchar(20),
    email           varchar(150),
    telefone        varchar(30),
    plano           varchar(20) NOT NULL DEFAULT 'basico', -- basico | pro | enterprise
    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 2. LOJA (mercearia ou mini_mercado)
-- =========================================================
CREATE TABLE loja (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    nome            varchar(150) NOT NULL,
    tipo_loja       varchar(20) NOT NULL DEFAULT 'mercearia'
                    CHECK (tipo_loja IN ('mercearia','mini_mercado')),
    provincia       varchar(50),
    cidade          varchar(80),
    endereco        text,
    moeda           varchar(5) NOT NULL DEFAULT 'MZN',

    -- flags de comportamento (config, não código)
    modo_pos        varchar(20) NOT NULL DEFAULT 'rapido'
                    CHECK (modo_pos IN ('rapido','completo')),
    permite_venda_granel   boolean NOT NULL DEFAULT false,
    permite_venda_fiado    boolean NOT NULL DEFAULT true,
    controla_lote_validade boolean NOT NULL DEFAULT false,
    stock_minimo_ativo     boolean NOT NULL DEFAULT true,

    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

-- Flags para landing page / vendas remotas (adicionar à tabela loja acima)
ALTER TABLE loja ADD COLUMN permite_venda_online   boolean NOT NULL DEFAULT false;
ALTER TABLE loja ADD COLUMN permite_reserva        boolean NOT NULL DEFAULT false;
ALTER TABLE loja ADD COLUMN slug_publico           varchar(80) UNIQUE; -- ex: shoplink.co.mz/loja/mkopo-baixa
ALTER TABLE loja ADD COLUMN tempo_expiracao_reserva_horas integer NOT NULL DEFAULT 24;

-- =========================================================
-- 3. UTILIZADORES & PERMISSÕES
-- =========================================================
CREATE TABLE utilizador (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    nome            varchar(150) NOT NULL,
    email           varchar(150) UNIQUE,
    telefone        varchar(30),
    senha_hash      varchar(255) NOT NULL,
    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE utilizador_loja (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    utilizador_id   uuid NOT NULL REFERENCES utilizador(id) ON DELETE CASCADE,
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    papel           varchar(20) NOT NULL DEFAULT 'caixa'
                    CHECK (papel IN ('dono','gestor','caixa','stock')),
    UNIQUE(utilizador_id, loja_id)
);

-- =========================================================
-- 4. CATÁLOGO — CATEGORIAS (configurável, não fixo)
-- =========================================================
CREATE TABLE categoria (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL,
    categoria_pai_id uuid REFERENCES categoria(id),
    ordem           integer DEFAULT 0
);

-- =========================================================
-- 5. FORNECEDORES
-- =========================================================
CREATE TABLE fornecedor (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(150) NOT NULL,
    contacto        varchar(30),
    email           varchar(150),
    endereco        text,
    ativo           boolean NOT NULL DEFAULT true
);

-- =========================================================
-- 6. PRODUTOS
-- =========================================================
CREATE TABLE produto (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    categoria_id    uuid REFERENCES categoria(id),
    fornecedor_id   uuid REFERENCES fornecedor(id),

    nome            varchar(200) NOT NULL,
    codigo_barras   varchar(50),          -- opcional (granel não tem)
    sku_interno     varchar(50),

    tipo_venda      varchar(20) NOT NULL DEFAULT 'unidade'
                    CHECK (tipo_venda IN ('unidade','peso','volume')),
    unidade_medida  varchar(10) NOT NULL DEFAULT 'un', -- un, kg, l, etc.

    preco_custo     numeric(12,2) NOT NULL DEFAULT 0,
    preco_venda     numeric(12,2) NOT NULL DEFAULT 0,

    controla_stock  boolean NOT NULL DEFAULT true,
    stock_minimo    numeric(12,3) DEFAULT 0,

    -- landing page / venda remota
    disponivel_online boolean NOT NULL DEFAULT false,
    descricao_publica text,

    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now(),

    UNIQUE(loja_id, codigo_barras)
);

CREATE INDEX idx_produto_loja ON produto(loja_id);
CREATE INDEX idx_produto_codigo_barras ON produto(codigo_barras);

-- =========================================================
-- 6.1 IMAGENS DO PRODUTO (armazenamento: Cloudinary)
-- =========================================================
-- Um produto pode ter várias imagens; a marcada como principal é usada
-- em listagens/POS, as restantes na galeria da ficha do produto (landing page).
CREATE TABLE produto_imagem (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id      uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,

    cloudinary_public_id   varchar(255) NOT NULL,  -- id devolvido pelo Cloudinary (para delete/transform)
    url                     varchar(500) NOT NULL, -- secure_url completo
    url_thumbnail           varchar(500),          -- variante transformada (ex: c_thumb,w_200)

    principal       boolean NOT NULL DEFAULT false,
    ordem           integer NOT NULL DEFAULT 0,

    largura         integer,
    altura          integer,
    formato         varchar(10),                   -- jpg, png, webp...

    data_upload     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_produto_imagem_produto ON produto_imagem(produto_id);

-- Garante no máximo 1 imagem principal por produto
CREATE UNIQUE INDEX idx_produto_imagem_principal_unica
    ON produto_imagem(produto_id)
    WHERE principal = true;

-- =========================================================
-- 7. STOCK — LOTES (só usado se controla_lote_validade = true)
-- =========================================================
CREATE TABLE lote_stock (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id      uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    numero_lote     varchar(50),
    data_validade   date,
    quantidade      numeric(12,3) NOT NULL DEFAULT 0,
    localizacao     varchar(50),          -- corredor/prateleira, opcional
    data_entrada    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lote_produto ON lote_stock(produto_id);
CREATE INDEX idx_lote_validade ON lote_stock(data_validade);

-- =========================================================
-- 8. MOVIMENTOS DE STOCK (auditoria — entradas/saídas/ajustes)
-- =========================================================
CREATE TABLE movimento_stock (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    lote_id         uuid REFERENCES lote_stock(id),
    utilizador_id   uuid REFERENCES utilizador(id),

    tipo            varchar(20) NOT NULL
                    CHECK (tipo IN ('entrada','saida_venda','ajuste','quebra','devolucao')),
    quantidade      numeric(12,3) NOT NULL,
    custo_unitario  numeric(12,2),
    referencia_id   uuid,                 -- FK lógica p/ venda_id ou compra_id
    observacao      text,
    data_movimento  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_stock_produto ON movimento_stock(produto_id);
CREATE INDEX idx_mov_stock_loja_data ON movimento_stock(loja_id, data_movimento);

-- Saldo atual de stock é calculado (view), não guardado diretamente:
CREATE VIEW vw_stock_atual AS
SELECT
    p.id AS produto_id,
    p.loja_id,
    p.nome,
    COALESCE(SUM(
        CASE WHEN m.tipo = 'entrada' THEN m.quantidade
             WHEN m.tipo = 'devolucao' THEN m.quantidade
             WHEN m.tipo IN ('saida_venda','quebra') THEN -m.quantidade
             WHEN m.tipo = 'ajuste' THEN m.quantidade
        END
    ), 0) AS quantidade_atual
FROM produto p
LEFT JOIN movimento_stock m ON m.produto_id = p.id
GROUP BY p.id, p.loja_id, p.nome;

-- =========================================================
-- 9. CAIXA (abertura/fecho/sangria)
-- =========================================================
CREATE TABLE caixa_sessao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    utilizador_id   uuid NOT NULL REFERENCES utilizador(id),
    conta_financeira_id uuid REFERENCES conta_financeira(id), -- conta 'caixa' correspondente

    valor_abertura  numeric(12,2) NOT NULL DEFAULT 0,
    valor_fecho     numeric(12,2),
    valor_esperado  numeric(12,2),
    diferenca       numeric(12,2),

    data_abertura   timestamptz NOT NULL DEFAULT now(),
    data_fecho      timestamptz,
    status          varchar(20) NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta','fechada'))
);

CREATE TABLE caixa_movimento (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caixa_sessao_id uuid NOT NULL REFERENCES caixa_sessao(id) ON DELETE CASCADE,
    tipo            varchar(20) NOT NULL
                    CHECK (tipo IN ('sangria','suprimento','venda')),
    valor           numeric(12,2) NOT NULL,
    observacao      text,
    data_movimento  timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 10. CLIENTES (necessário p/ venda fiado)
-- =========================================================
CREATE TABLE cliente (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(150) NOT NULL,
    telefone        varchar(30),
    limite_fiado    numeric(12,2) DEFAULT 0,
    ativo           boolean NOT NULL DEFAULT true
);

-- =========================================================
-- 11. VENDAS (POS)
-- =========================================================
CREATE TABLE venda (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    caixa_sessao_id uuid REFERENCES caixa_sessao(id),
    utilizador_id   uuid NOT NULL REFERENCES utilizador(id),
    cliente_id      uuid REFERENCES cliente(id),

    numero_recibo   varchar(30) NOT NULL,
    subtotal        numeric(12,2) NOT NULL DEFAULT 0,
    desconto_total  numeric(12,2) NOT NULL DEFAULT 0,
    total           numeric(12,2) NOT NULL DEFAULT 0,

    status          varchar(20) NOT NULL DEFAULT 'concluida'
                    CHECK (status IN ('concluida','cancelada','pendente_fiado')),

    -- offline-first: registada localmente e sincronizada depois
    origem          varchar(10) NOT NULL DEFAULT 'online'
                    CHECK (origem IN ('online','offline')),
    sincronizado_em timestamptz,

    data_venda      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(loja_id, numero_recibo)
);

CREATE INDEX idx_venda_loja_data ON venda(loja_id, data_venda);

CREATE TABLE venda_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id        uuid NOT NULL REFERENCES venda(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    lote_id         uuid REFERENCES lote_stock(id),

    quantidade      numeric(12,3) NOT NULL,
    preco_unitario  numeric(12,2) NOT NULL,
    desconto_linha  numeric(12,2) NOT NULL DEFAULT 0,
    subtotal_linha  numeric(12,2) NOT NULL
);

CREATE INDEX idx_venda_item_venda ON venda_item(venda_id);
CREATE INDEX idx_venda_item_produto ON venda_item(produto_id);

CREATE TABLE venda_pagamento (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id        uuid NOT NULL REFERENCES venda(id) ON DELETE CASCADE,
    conta_financeira_id uuid REFERENCES conta_financeira(id), -- destino do valor (nulo se fiado)
    metodo          varchar(20) NOT NULL
                    CHECK (metodo IN ('dinheiro','mpesa','emola','cartao','fiado')),
    valor           numeric(12,2) NOT NULL
);

-- =========================================================
-- 12. ENCOMENDAS ONLINE / RESERVAS (landing page pública)
-- =========================================================

-- Cliente da landing page (pode não ter conta cliente interna ainda)
CREATE TABLE cliente_online (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_id      uuid REFERENCES cliente(id),   -- ligado se já existir no sistema
    nome            varchar(150) NOT NULL,
    telefone        varchar(30) NOT NULL,
    email           varchar(150),
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedido_online (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_online_id uuid NOT NULL REFERENCES cliente_online(id),

    numero_pedido   varchar(30) NOT NULL,
    tipo            varchar(20) NOT NULL
                    CHECK (tipo IN ('reserva','compra_online')),

    -- reserva: cliente confirma/paga na loja; compra_online: pagamento já feito
    metodo_pagamento varchar(20)
                    CHECK (metodo_pagamento IN ('mpesa','emola','cartao','na_loja')),
    status_pagamento varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status_pagamento IN ('pendente','pago','falhou','reembolsado')),

    tipo_entrega    varchar(20) NOT NULL DEFAULT 'levantamento'
                    CHECK (tipo_entrega IN ('levantamento','entrega_domicilio')),
    endereco_entrega text,

    subtotal        numeric(12,2) NOT NULL DEFAULT 0,
    total           numeric(12,2) NOT NULL DEFAULT 0,

    status          varchar(20) NOT NULL DEFAULT 'aguardando_confirmacao'
                    CHECK (status IN (
                        'aguardando_confirmacao', -- cliente submeteu, stock reservado
                        'confirmado',             -- loja confirmou disponibilidade
                        'pronto_levantamento',
                        'concluido',              -- convertido em venda
                        'expirado',               -- reserva não confirmada a tempo
                        'cancelado'
                    )),

    venda_id        uuid REFERENCES venda(id),    -- preenchido quando concluído
    data_expiracao  timestamptz,                  -- calculada: data_criacao + tempo_expiracao_reserva_horas
    data_criacao    timestamptz NOT NULL DEFAULT now(),
    data_atualizacao timestamptz NOT NULL DEFAULT now(),

    UNIQUE(loja_id, numero_pedido)
);

CREATE INDEX idx_pedido_online_loja_status ON pedido_online(loja_id, status);
CREATE INDEX idx_pedido_online_expiracao ON pedido_online(data_expiracao) WHERE status = 'aguardando_confirmacao';

CREATE TABLE pedido_online_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_online_id uuid NOT NULL REFERENCES pedido_online(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    quantidade      numeric(12,3) NOT NULL,
    preco_unitario  numeric(12,2) NOT NULL,
    subtotal_linha  numeric(12,2) NOT NULL
);

-- Reserva de stock: enquanto pedido está 'aguardando_confirmacao' ou 'confirmado',
-- a quantidade fica bloqueada sem gerar movimento_stock (ainda não saiu fisicamente).
CREATE TABLE stock_reserva (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id      uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    pedido_online_id uuid NOT NULL REFERENCES pedido_online(id) ON DELETE CASCADE,
    quantidade      numeric(12,3) NOT NULL,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_reserva_produto ON stock_reserva(produto_id);

-- Disponibilidade real = stock atual − reservas ativas
-- (usada pela landing page para mostrar "X disponíveis" e bloquear compra acima do limite)
CREATE VIEW vw_stock_disponivel AS
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

-- =========================================================
-- 12.1 Regras de negócio para o fluxo de reserva/compra remota
-- =========================================================
-- 1. Cliente na landing page só vê/compra produtos com disponivel_online = true
--    e loja.permite_venda_online = true (ou permite_reserva = true).
-- 2. Ao submeter pedido: validar quantidade_disponivel (vw_stock_disponivel) >= quantidade pedida
--    dentro da MESMA transação, depois inserir pedido_online + pedido_online_item + stock_reserva.
-- 3. Se tipo = 'compra_online': após confirmação de pagamento (webhook M-Pesa/Emola/cartão),
--    status_pagamento -> 'pago'.
-- 4. Ao chegar à loja / confirmar entrega: gerar venda + venda_item a partir do pedido_online,
--    criar movimento_stock (tipo='saida_venda'), status pedido_online -> 'concluido',
--    apagar/ignorar linhas correspondentes em stock_reserva (a saída real substitui a reserva).
-- 5. Job periódico (cron): pedidos com status='aguardando_confirmacao' e
--    data_expiracao < now() -> status='expirado'; stock_reserva correspondente é libertado
--    automaticamente (a view recalcula porque o status muda).
-- 6. Cancelamento manual pela loja ou cliente: status='cancelado', mesma libertação.

-- =========================================================
-- 14. GESTÃO FINANCEIRA
-- =========================================================

-- 14.1 CONTAS FINANCEIRAS (bancos, mobile money, caixa físico)
CREATE TABLE conta_financeira (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL,          -- "Caixa Loja", "BCI Conta Corrente", "M-Pesa Comercial"
    tipo            varchar(20) NOT NULL
                    CHECK (tipo IN ('caixa','banco','mpesa','emola','outro')),
    numero_conta    varchar(50),
    saldo_inicial   numeric(14,2) NOT NULL DEFAULT 0,
    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now()
);

-- 14.2 CATEGORIAS FINANCEIRAS (plano de contas simplificado, hierárquico)
CREATE TABLE categoria_financeira (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL,          -- "Renda", "Salários", "Fornecedores", "Vendas", "Outras Receitas"
    tipo            varchar(10) NOT NULL
                    CHECK (tipo IN ('receita','despesa')),
    categoria_pai_id uuid REFERENCES categoria_financeira(id),
    ordem           integer DEFAULT 0
);

-- 14.3 CENTRO DE CUSTO (opcional — útil p/ tenant com várias lojas comparar despesas)
CREATE TABLE centro_custo (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    nome            varchar(100) NOT NULL            -- "Administrativo", "Logística", "Marketing"
);

-- 14.4 LANÇAMENTOS FINANCEIROS (livro-razão — toda entrada/saída de dinheiro passa aqui)
CREATE TABLE lancamento_financeiro (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    conta_financeira_id uuid NOT NULL REFERENCES conta_financeira(id),
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    centro_custo_id uuid REFERENCES centro_custo(id),

    tipo            varchar(10) NOT NULL
                    CHECK (tipo IN ('receita','despesa','transferencia')),
    valor           numeric(14,2) NOT NULL,
    descricao       varchar(255),

    -- origem automática (venda, compra, conta a pagar/receber) ou lançamento manual
    origem_tipo     varchar(20)
                    CHECK (origem_tipo IN ('venda','compra','conta_pagar','conta_receber','manual','transferencia')),
    origem_id       uuid,                            -- FK lógica para venda_id / compra_id / conta_pagar_id / etc.

    status          varchar(20) NOT NULL DEFAULT 'confirmado'
                    CHECK (status IN ('confirmado','pendente','cancelado')),

    utilizador_id   uuid REFERENCES utilizador(id),
    data_lancamento timestamptz NOT NULL DEFAULT now(),
    data_competencia date NOT NULL DEFAULT CURRENT_DATE  -- mês/ano a que a despesa/receita pertence (regime de competência)
);

CREATE INDEX idx_lanc_fin_loja_data ON lancamento_financeiro(loja_id, data_lancamento);
CREATE INDEX idx_lanc_fin_conta ON lancamento_financeiro(conta_financeira_id);
CREATE INDEX idx_lanc_fin_categoria ON lancamento_financeiro(categoria_financeira_id);
CREATE INDEX idx_lanc_fin_competencia ON lancamento_financeiro(loja_id, data_competencia);

-- 14.5 CONTAS A PAGAR (fornecedores, renda, salários, serviços — com parcelamento)
CREATE TABLE conta_pagar (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    fornecedor_id   uuid REFERENCES fornecedor(id),
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    compra_id       uuid REFERENCES compra(id),      -- ligado se originada de uma compra

    descricao       varchar(255) NOT NULL,
    valor_total     numeric(14,2) NOT NULL,
    numero_parcelas integer NOT NULL DEFAULT 1,
    data_emissao    date NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento date NOT NULL,

    status          varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','pago_parcial','pago','atrasado','cancelado')),

    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conta_pagar_parcela (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_pagar_id  uuid NOT NULL REFERENCES conta_pagar(id) ON DELETE CASCADE,
    numero_parcela  integer NOT NULL,
    valor           numeric(14,2) NOT NULL,
    data_vencimento date NOT NULL,
    data_pagamento  date,
    lancamento_financeiro_id uuid REFERENCES lancamento_financeiro(id), -- preenchido ao pagar
    status          varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','pago','atrasado','cancelado'))
);

CREATE INDEX idx_conta_pagar_loja_status ON conta_pagar(loja_id, status);
CREATE INDEX idx_conta_pagar_parcela_venc ON conta_pagar_parcela(data_vencimento) WHERE status = 'pendente';

-- 14.6 CONTAS A RECEBER (vendas fiado, clientes a prazo)
CREATE TABLE conta_receber (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    cliente_id      uuid NOT NULL REFERENCES cliente(id),
    venda_id        uuid REFERENCES venda(id),       -- ligado se originada de venda fiado

    descricao       varchar(255),
    valor_total     numeric(14,2) NOT NULL,
    data_emissao    date NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento date NOT NULL,

    status          varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','recebido_parcial','recebido','atrasado','cancelado')),

    data_criacao    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conta_receber_parcela (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_receber_id uuid NOT NULL REFERENCES conta_receber(id) ON DELETE CASCADE,
    numero_parcela  integer NOT NULL,
    valor           numeric(14,2) NOT NULL,
    data_vencimento date NOT NULL,
    data_recebimento date,
    lancamento_financeiro_id uuid REFERENCES lancamento_financeiro(id),
    status          varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','recebido','atrasado','cancelado'))
);

CREATE INDEX idx_conta_receber_loja_status ON conta_receber(loja_id, status);
CREATE INDEX idx_conta_receber_parcela_venc ON conta_receber_parcela(data_vencimento) WHERE status = 'pendente';

-- 14.7 TRANSFERÊNCIAS ENTRE CONTAS (ex: caixa físico -> banco)
CREATE TABLE transferencia_financeira (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    conta_origem_id uuid NOT NULL REFERENCES conta_financeira(id),
    conta_destino_id uuid NOT NULL REFERENCES conta_financeira(id),
    valor           numeric(14,2) NOT NULL,
    observacao      text,
    utilizador_id   uuid REFERENCES utilizador(id),
    data_transferencia timestamptz NOT NULL DEFAULT now(),
    CHECK (conta_origem_id <> conta_destino_id)
);

-- 14.8 DESPESAS RECORRENTES (renda, salários, internet, assinaturas — geram conta_pagar automaticamente)
CREATE TABLE despesa_recorrente (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    fornecedor_id   uuid REFERENCES fornecedor(id),
    descricao       varchar(255) NOT NULL,
    valor           numeric(14,2) NOT NULL,
    dia_vencimento  integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
    ativo           boolean NOT NULL DEFAULT true,
    data_inicio     date NOT NULL DEFAULT CURRENT_DATE,
    data_fim        date
);
-- Job mensal (cron) lê despesa_recorrente ativas e gera conta_pagar + conta_pagar_parcela automaticamente.

-- 14.9 SALDO ATUAL POR CONTA (calculado a partir dos lançamentos confirmados)
CREATE VIEW vw_saldo_contas AS
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

-- 14.10 DRE SIMPLIFICADO — Demonstração de Resultados por mês/loja
CREATE VIEW vw_dre_mensal AS
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

-- 14.11 FLUXO DE CAIXA PREVISTO (pendentes a pagar/receber, próximos 90 dias)
CREATE VIEW vw_fluxo_caixa_previsto AS
SELECT loja_id, 'a_pagar' AS tipo, data_vencimento, valor AS valor_previsto
FROM conta_pagar_parcela pp
JOIN conta_pagar cp ON cp.id = pp.conta_pagar_id
WHERE pp.status = 'pendente'
UNION ALL
SELECT loja_id, 'a_receber' AS tipo, data_vencimento, valor AS valor_previsto
FROM conta_receber_parcela rp
JOIN conta_receber cr ON cr.id = rp.conta_receber_id
WHERE rp.status = 'pendente';

-- =========================================================
-- 14.12 Regras de negócio — Gestão Financeira
-- =========================================================
-- 1. Toda venda concluída (venda.status='concluida') gera automaticamente um
--    lancamento_financeiro (tipo='receita', origem_tipo='venda', origem_id=venda.id),
--    usando venda_pagamento.metodo para escolher conta_financeira_id
--    (dinheiro -> conta 'caixa' da loja, mpesa/emola -> respetiva conta).
-- 2. Venda com pagamento 'fiado' NÃO gera lançamento imediato — gera conta_receber
--    + conta_receber_parcela (status pendente); lançamento só é criado ao receber.
-- 3. Toda compra (compra.status='recebida') pode gerar conta_pagar automaticamente
--    (1 parcela = pagamento à vista, ou N parcelas conforme acordo com fornecedor).
-- 4. Pagamento de parcela (conta_pagar_parcela / conta_receber_parcela):
--    cria lancamento_financeiro correspondente e associa via lancamento_financeiro_id;
--    atualiza status da parcela e recalcula status agregado da conta_pagar/conta_receber.
-- 5. Job diário (cron): parcelas com data_vencimento < today e status='pendente'
--    -> status='atrasado' (em ambas conta_pagar_parcela e conta_receber_parcela).
-- 6. Fecho de caixa (caixa_sessao) concilia com vw_saldo_contas da conta 'caixa' da loja
--    no momento do fecho — diferença registada em caixa_sessao.diferenca.
-- 7. Todos os valores em lancamento_financeiro usam data_competencia (regime de
--    competência) separada de data_lancamento (quando foi de facto registado),
--    permitindo relatórios corretos mesmo com lançamentos retroativos.

-- =========================================================
-- 15. COMPRAS (entrada de mercadoria de fornecedores)
-- =========================================================
CREATE TABLE compra (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    fornecedor_id   uuid REFERENCES fornecedor(id),
    utilizador_id   uuid REFERENCES utilizador(id),
    total           numeric(12,2) NOT NULL DEFAULT 0,
    status          varchar(20) NOT NULL DEFAULT 'recebida'
                    CHECK (status IN ('pendente','recebida','cancelada')),
    data_compra     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE compra_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id       uuid NOT NULL REFERENCES compra(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    quantidade      numeric(12,3) NOT NULL,
    custo_unitario  numeric(12,2) NOT NULL
);

-- =========================================================
-- 16. GESTÃO RIGOROSA DE STOCK (contagem, transferências, validade)
-- =========================================================

-- 16.1 Contagem de inventário (auditoria física periódica)
CREATE TABLE inventario_contagem (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    utilizador_id   uuid REFERENCES utilizador(id),
    descricao       varchar(150),                    -- "Inventário mensal Set/2026"
    status          varchar(20) NOT NULL DEFAULT 'aberto'
                    CHECK (status IN ('aberto','fechado')),
    data_inicio     timestamptz NOT NULL DEFAULT now(),
    data_fecho      timestamptz
);

CREATE TABLE inventario_contagem_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inventario_contagem_id uuid NOT NULL REFERENCES inventario_contagem(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    quantidade_sistema numeric(12,3) NOT NULL,       -- snapshot de vw_stock_atual no momento
    quantidade_contada numeric(12,3),
    diferenca       numeric(12,3) GENERATED ALWAYS AS (quantidade_contada - quantidade_sistema) STORED,
    observacao      text
);
-- Ao fechar o inventário: cada item com diferença <> 0 gera automaticamente
-- um movimento_stock (tipo='ajuste') para igualar sistema à contagem física.

-- 16.2 Transferência de stock entre lojas (mesmo tenant)
CREATE TABLE transferencia_stock (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_origem_id  uuid NOT NULL REFERENCES loja(id),
    loja_destino_id uuid NOT NULL REFERENCES loja(id),
    utilizador_id   uuid REFERENCES utilizador(id),
    status          varchar(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','em_transito','recebida','cancelada')),
    data_envio      timestamptz NOT NULL DEFAULT now(),
    data_recebimento timestamptz,
    CHECK (loja_origem_id <> loja_destino_id)
);

CREATE TABLE transferencia_stock_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transferencia_stock_id uuid NOT NULL REFERENCES transferencia_stock(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id),
    quantidade      numeric(12,3) NOT NULL
);
-- Ao enviar: movimento_stock (tipo='saida_venda' variante 'transferencia_saida') na loja origem.
-- Ao confirmar receção: movimento_stock (tipo='entrada' variante 'transferencia_entrada') na loja destino.

-- =========================================================
-- 17. GESTÃO DE DESPESAS (orçamento vs. realizado)
-- =========================================================

-- Orçamento mensal por categoria — para comparar planeado vs. gasto real
CREATE TABLE orcamento_despesa (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,
    categoria_financeira_id uuid NOT NULL REFERENCES categoria_financeira(id),
    mes_referencia  date NOT NULL,                   -- primeiro dia do mês
    valor_orcado    numeric(14,2) NOT NULL,
    UNIQUE(loja_id, categoria_financeira_id, mes_referencia)
);

-- Orçado vs. realizado (junta com lancamento_financeiro tipo='despesa')
CREATE VIEW vw_orcamento_vs_real AS
SELECT
    o.loja_id,
    o.mes_referencia,
    cf.nome AS categoria,
    o.valor_orcado,
    COALESCE(SUM(l.valor), 0) AS valor_realizado,
    o.valor_orcado - COALESCE(SUM(l.valor), 0) AS saldo_disponivel
FROM orcamento_despesa o
JOIN categoria_financeira cf ON cf.id = o.categoria_financeira_id
LEFT JOIN lancamento_financeiro l
    ON l.categoria_financeira_id = o.categoria_financeira_id
    AND l.loja_id = o.loja_id
    AND l.status = 'confirmado'
    AND date_trunc('month', l.data_competencia) = o.mes_referencia
GROUP BY o.loja_id, o.mes_referencia, cf.nome, o.valor_orcado;

-- =========================================================
-- 18. ALERTAS (motor de notificações do sistema)
-- =========================================================
CREATE TABLE alerta (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id         uuid NOT NULL REFERENCES loja(id) ON DELETE CASCADE,

    tipo            varchar(30) NOT NULL
                    CHECK (tipo IN (
                        'stock_baixo',
                        'stock_esgotado',
                        'produto_vencendo',       -- lote perto da data_validade
                        'produto_vencido',
                        'conta_pagar_vencendo',
                        'conta_pagar_atrasada',
                        'conta_receber_atrasada',
                        'diferenca_caixa',
                        'reserva_expirando',
                        'meta_venda_atingida'
                    )),
    nivel           varchar(10) NOT NULL DEFAULT 'aviso'
                    CHECK (nivel IN ('info','aviso','critico')),

    referencia_tipo varchar(30),                     -- 'produto','conta_pagar','lote_stock','caixa_sessao'...
    referencia_id   uuid,

    mensagem        varchar(300) NOT NULL,
    lido            boolean NOT NULL DEFAULT false,
    resolvido       boolean NOT NULL DEFAULT false,

    data_criacao    timestamptz NOT NULL DEFAULT now(),
    data_leitura    timestamptz
);

CREATE INDEX idx_alerta_loja_pendente ON alerta(loja_id) WHERE resolvido = false;
CREATE INDEX idx_alerta_tipo ON alerta(tipo);

-- Geração automática (job periódico ou trigger):
--   stock_baixo        -> vw_stock_disponivel.quantidade_disponivel <= produto.stock_minimo
--   produto_vencendo   -> lote_stock.data_validade <= now() + 7 dias
--   conta_pagar_vencendo -> conta_pagar_parcela.data_vencimento <= now() + 3 dias
--   diferenca_caixa    -> caixa_sessao.diferenca <> 0 ao fechar

-- =========================================================
-- 19. GESTÃO DE FORNECEDORES (avaliação e histórico)
-- =========================================================

-- Ampliar tabela fornecedor com dados de rigor comercial
ALTER TABLE fornecedor ADD COLUMN nuit              varchar(20);
ALTER TABLE fornecedor ADD COLUMN condicao_pagamento varchar(50);   -- "30 dias", "à vista"
ALTER TABLE fornecedor ADD COLUMN prazo_entrega_dias integer;
ALTER TABLE fornecedor ADD COLUMN avaliacao_media    numeric(3,2);  -- 0.00 a 5.00, calculada

CREATE TABLE fornecedor_avaliacao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fornecedor_id   uuid NOT NULL REFERENCES fornecedor(id) ON DELETE CASCADE,
    compra_id       uuid REFERENCES compra(id),
    nota            integer NOT NULL CHECK (nota BETWEEN 1 AND 5),
    pontualidade    integer CHECK (pontualidade BETWEEN 1 AND 5),
    qualidade       integer CHECK (qualidade BETWEEN 1 AND 5),
    comentario       text,
    utilizador_id   uuid REFERENCES utilizador(id),
    data_avaliacao  timestamptz NOT NULL DEFAULT now()
);

-- Histórico de preços por fornecedor (para comparar e negociar)
CREATE TABLE fornecedor_produto_preco (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fornecedor_id   uuid NOT NULL REFERENCES fornecedor(id) ON DELETE CASCADE,
    produto_id      uuid NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    preco_custo     numeric(12,2) NOT NULL,
    data_registo    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forn_produto_preco ON fornecedor_produto_preco(fornecedor_id, produto_id);

-- =========================================================
-- 20. CAIXA PDV — CONFERÊNCIA RIGOROSA (contagem por denominação)
-- =========================================================
CREATE TABLE caixa_conferencia_denominacao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caixa_sessao_id uuid NOT NULL REFERENCES caixa_sessao(id) ON DELETE CASCADE,
    momento         varchar(10) NOT NULL CHECK (momento IN ('abertura','fecho')),
    valor_nota      numeric(10,2) NOT NULL,          -- 1000, 500, 200, 100, 50, 20, 10, 5, 1
    quantidade      integer NOT NULL DEFAULT 0,
    subtotal        numeric(12,2) GENERATED ALWAYS AS (valor_nota * quantidade) STORED
);
-- Soma de 'fecho' compara-se com caixa_sessao.valor_esperado; a diferença
-- alimenta caixa_sessao.diferenca e pode disparar alerta tipo='diferenca_caixa'.

-- =========================================================
-- 21. RELATÓRIOS AVANÇADOS / BI — VIEWS ANALÍTICAS
-- =========================================================

-- 21.1 Vendas diárias por loja (base para gráficos de tendência)
CREATE VIEW vw_vendas_diarias AS
SELECT
    v.loja_id,
    date_trunc('day', v.data_venda)::date AS dia,
    COUNT(DISTINCT v.id) AS numero_vendas,
    SUM(v.total) AS total_vendido,
    AVG(v.total) AS ticket_medio
FROM venda v
WHERE v.status = 'concluida'
GROUP BY v.loja_id, date_trunc('day', v.data_venda);

-- 21.2 Ranking de produtos mais vendidos (quantidade e faturação)
CREATE VIEW vw_produtos_mais_vendidos AS
SELECT
    vi.produto_id,
    p.loja_id,
    p.nome,
    SUM(vi.quantidade) AS quantidade_vendida,
    SUM(vi.subtotal_linha) AS total_faturado
FROM venda_item vi
JOIN venda v ON v.id = vi.venda_id AND v.status = 'concluida'
JOIN produto p ON p.id = vi.produto_id
GROUP BY vi.produto_id, p.loja_id, p.nome;

-- 21.3 Curva ABC de produtos (classificação por contribuição na faturação)
CREATE VIEW vw_curva_abc_produtos AS
WITH ranking AS (
    SELECT
        *,
        SUM(total_faturado) OVER (PARTITION BY loja_id ORDER BY total_faturado DESC) /
        NULLIF(SUM(total_faturado) OVER (PARTITION BY loja_id), 0) AS percentual_acumulado
    FROM vw_produtos_mais_vendidos
)
SELECT *,
    CASE
        WHEN percentual_acumulado <= 0.80 THEN 'A'
        WHEN percentual_acumulado <= 0.95 THEN 'B'
        ELSE 'C'
    END AS classe_abc
FROM ranking;

-- 21.4 Margem por produto (preço venda vs. custo médio)
CREATE VIEW vw_margem_produtos AS
SELECT
    p.id AS produto_id,
    p.loja_id,
    p.nome,
    p.preco_custo,
    p.preco_venda,
    p.preco_venda - p.preco_custo AS margem_absoluta,
    CASE WHEN p.preco_venda > 0
        THEN round(((p.preco_venda - p.preco_custo) / p.preco_venda) * 100, 2)
        ELSE 0
    END AS margem_percentual
FROM produto p;

-- 21.5 Desempenho por vendedor/operador de caixa
CREATE VIEW vw_desempenho_vendedor AS
SELECT
    v.utilizador_id,
    v.loja_id,
    u.nome AS vendedor,
    COUNT(v.id) AS numero_vendas,
    SUM(v.total) AS total_vendido,
    AVG(v.total) AS ticket_medio
FROM venda v
JOIN utilizador u ON u.id = v.utilizador_id
WHERE v.status = 'concluida'
GROUP BY v.utilizador_id, v.loja_id, u.nome;

-- 21.6 Comparativo entre lojas (para dono com múltiplas lojas)
CREATE VIEW vw_comparativo_lojas AS
SELECT
    l.id AS loja_id,
    l.nome AS loja,
    l.tipo_loja,
    date_trunc('month', v.data_venda)::date AS mes,
    COUNT(v.id) AS numero_vendas,
    SUM(v.total) AS total_vendido
FROM loja l
LEFT JOIN venda v ON v.loja_id = l.id AND v.status = 'concluida'
GROUP BY l.id, l.nome, l.tipo_loja, date_trunc('month', v.data_venda);

-- 21.7 Painel executivo (KPIs agregados do mês corrente, 1 linha por loja)
CREATE VIEW vw_dashboard_executivo AS
SELECT
    l.id AS loja_id,
    l.nome AS loja,
    (SELECT COALESCE(SUM(total), 0) FROM venda
        WHERE loja_id = l.id AND status = 'concluida'
        AND date_trunc('month', data_venda) = date_trunc('month', now())) AS faturacao_mes,
    (SELECT COUNT(*) FROM produto
        WHERE loja_id = l.id AND ativo = true) AS total_produtos_ativos,
    (SELECT COUNT(*) FROM vw_stock_disponivel s
        JOIN produto p ON p.id = s.produto_id
        WHERE p.loja_id = l.id AND s.quantidade_disponivel <= p.stock_minimo) AS produtos_stock_baixo,
    (SELECT COUNT(*) FROM alerta WHERE loja_id = l.id AND resolvido = false) AS alertas_pendentes,
    (SELECT COALESCE(SUM(valor_total - COALESCE((SELECT SUM(valor) FROM conta_pagar_parcela WHERE conta_pagar_id = conta_pagar.id AND status='pago'),0)),0)
        FROM conta_pagar WHERE loja_id = l.id AND status != 'pago') AS total_a_pagar,
    (SELECT COALESCE(SUM(valor_total - COALESCE((SELECT SUM(valor) FROM conta_receber_parcela WHERE conta_receber_id = conta_receber.id AND status='recebido'),0)),0)
        FROM conta_receber WHERE loja_id = l.id AND status != 'recebido') AS total_a_receber
FROM loja l;
```

---

## 3. Alertas — Gatilhos e Responsáveis

| Alerta | Gatilho | Frequência de verificação |
|---|---|---|
| `stock_baixo` / `stock_esgotado` | `quantidade_disponivel <= stock_minimo` | Após cada venda/movimento (trigger) ou a cada 15 min |
| `produto_vencendo` / `produto_vencido` | `lote_stock.data_validade` a 7 dias ou já passada | Job diário |
| `conta_pagar_vencendo` / `atrasada` | `conta_pagar_parcela.data_vencimento` | Job diário |
| `conta_receber_atrasada` | `conta_receber_parcela.data_vencimento` | Job diário |
| `diferenca_caixa` | `caixa_sessao.diferenca <> 0` | Ao fechar caixa (evento) |
| `reserva_expirando` | `pedido_online.data_expiracao` a 2h | Job periódico (a cada 30 min) |

## 4. Relatórios/BI — Mapeamento para Gráficos no Frontend

| View | Tipo de gráfico sugerido |
|---|---|
| `vw_vendas_diarias` | Linha (tendência de faturação ao longo do tempo) |
| `vw_produtos_mais_vendidos` | Barras horizontais (top 10) |
| `vw_curva_abc_produtos` | Pareto (barras + linha acumulada) |
| `vw_margem_produtos` | Tabela ordenável + destaque de margem baixa |
| `vw_desempenho_vendedor` | Barras comparativas por operador |
| `vw_comparativo_lojas` | Linha multi-série (uma linha por loja) |
| `vw_orcamento_vs_real` | Barras agrupadas (orçado vs. realizado) |
| `vw_dashboard_executivo` | Cards de KPI no topo do painel principal |

---

## 5. Como a Flexibilidade Mercearia ↔ Mini-Mercado Funciona

| Configuração | Mercearia (típico) | Mini Mercado (típico) |
|---|---|---|
| `modo_pos` | `rapido` (poucos campos, venda ao balcão) | `completo` (código de barras, múltiplos pagamentos) |
| `permite_venda_granel` | `true` (açúcar, arroz a granel) | `false` ou `true` conforme loja |
| `controla_lote_validade` | `false` | `true` (frescos, lacticínios) |
| `stock_minimo_ativo` | opcional | `true` (alertas de reposição) |

Nenhuma tabela muda — apenas o **frontend lê estas flags** e adapta a interface (esconde/mostra campos, valida regras).

---

## 6. Índices e Performance — Notas

- Todas as tabelas transacionais indexadas por `loja_id` (isolamento multi-loja rápido).
- `vw_stock_atual` é uma view calculada — para lojas com alto volume de vendas, considerar **materialized view** com refresh periódico ou trigger de saldo cacheado em `produto.stock_atual_cache`.
- `movimento_stock` funciona como **ledger append-only** — nunca fazer UPDATE/DELETE de quantidade diretamente; sempre novo movimento (auditável).

---

## 7. Gestão Financeira — Visão Geral

Módulo completo de fluxo de caixa, contas a pagar/receber e resultados, integrado automaticamente com vendas e compras — não é um sistema financeiro à parte.

| Componente | Função |
|---|---|
| `conta_financeira` | Cada "carteira" da loja: caixa físico, banco, M-Pesa, Emola |
| `categoria_financeira` | Plano de contas simplificado (receitas/despesas, hierárquico) |
| `lancamento_financeiro` | Livro-razão — todo movimento de dinheiro confirmado passa aqui |
| `conta_pagar` / `conta_receber` | Obrigações futuras (fornecedores, fiado) com parcelamento |
| `despesa_recorrente` | Renda, salários, internet — gera `conta_pagar` automaticamente todo mês |
| `transferencia_financeira` | Movimento entre contas (ex: caixa → depósito bancário) |

**Automatismos:**
- Venda concluída → `lancamento_financeiro` (receita) automático por método de pagamento.
- Venda fiado → `conta_receber` (sem lançamento até ser recebida).
- Compra recebida → `conta_pagar` (à vista ou parcelada).
- Parcela paga/recebida → gera `lancamento_financeiro` e atualiza status.
- Cron diário → marca parcelas vencidas como `atrasado`.
- Cron mensal → gera `conta_pagar` a partir de `despesa_recorrente`.

**Relatórios disponíveis via views:**
- `vw_saldo_contas` — saldo atual de cada conta (caixa, banco, mobile money).
- `vw_dre_mensal` — Demonstração de Resultados por mês/loja (receitas vs. despesas por categoria).
- `vw_fluxo_caixa_previsto` — projeção de entradas/saídas pendentes (próximos vencimentos).

## 8. Landing Page — Compra e Reserva Remota

**Fluxo do cliente:**
1. Acede a `shoplink.co.mz/loja/{slug_publico}` → vê apenas produtos com `disponivel_online = true`.
2. Cada produto mostra `quantidade_disponivel` (de `vw_stock_disponivel`, não o stock físico total).
3. Escolhe **Reservar** (paga/confirma na loja) ou **Comprar** (paga já — M-Pesa/Emola/cartão), conforme `loja.permite_reserva` / `permite_venda_online`.
4. Ao submeter, sistema valida disponibilidade em transação e cria `pedido_online` + `stock_reserva` — stock fica bloqueado sem sair fisicamente.
5. Reserva expira automaticamente após `tempo_expiracao_reserva_horas` se não confirmada.
6. Na loja: gestor confirma/atende o pedido → gera `venda` real, baixa stock via `movimento_stock`.

**Endpoints sugeridos:**
- `GET /publico/{slug}/produtos` — catálogo com disponibilidade
- `POST /publico/{slug}/pedidos` — criar reserva/compra
- `POST /pedidos/{id}/confirmar` — loja confirma (interno)
- `POST /webhooks/pagamento/{provedor}` — callback M-Pesa/Emola/cartão
- `POST /jobs/expirar-reservas` — cron para libertar stock

**Imagens de produto (Cloudinary):**
- Upload feito no backend (assinado) ou via *unsigned upload preset* restrito ao folder da loja: `shoplink/{loja_id}/produtos/`.
- Guardar em `produto_imagem`: `cloudinary_public_id` (necessário para apagar/transformar depois) e `url` (secure_url).
- Usar *transformations* do Cloudinary on-the-fly para `url_thumbnail` (ex.: `c_fill,w_200,h_200,q_auto,f_auto`) em vez de gerar/guardar múltiplos ficheiros.
- Ao remover produto ou imagem, apagar também no Cloudinary via API (`destroy(public_id)`) para não acumular lixo de storage.

## 9. Sincronização Offline-First (POS)

Recomendação para `venda` e `venda_item`:
1. App POS grava localmente (SQLite/IndexedDB) com UUID gerado no cliente.
2. Ao reconectar, faz `INSERT ... ON CONFLICT (id) DO NOTHING` no Postgres.
3. Campo `origem` + `sincronizado_em` permite auditoria de vendas feitas offline.

## 10. Licença / Assinatura (Adicionado na v4)

Cada loja tem uma licença mensal de **2.500,00 MZN**, paga por cartão através da NetShop (BCI ou BIM). A validade renova por **+30 dias** contados do fim atual se a licença estiver ativa, ou do dia do pagamento se estiver expirada/bloqueada. Quando a licença expira ou é bloqueada, o utilizador é levado diretamente para o ecrã de pagamento/renovação.

**Novas tabelas (`scripts/migrate_v4.sql`):**
- `licenca` — uma por loja: `estado` (`ativa|expirada|bloqueada`), `plano` (`mensal`), `valor_mensal` (2500), `data_inicio`, `data_fim`.
- `licenca_pagamento` — histórico: `metodo` (`bci|bim|manual`), `referencia_pagamento` (prefixo `LIC_` — identifica a app nos webhooks, como `PO_` nos pedidos), `cobranca_id`/`checkout_url` (NetShop), `status` (`pendente|pago|falhou|reembolsado`), `periodo_inicio`/`periodo_fim` (período faturado), `recibo_numero` (ex. `REC-LIC-YYYYMMDD-SS`), `recibo_enviado`/`data_envio_recibo`.

**Renovação automática (`aplicarPagamentoLicenca`):**
```
novo_fim = (estado = 'ativa' AND data_fim > now()) ? data_fim + 30 dias : now() + 30 dias
estado -> 'ativa'; licenca_pagamento -> 'pago'
```

**Endpoints:**
- `GET /api/licenca` — estado + histórico de pagamentos/recibos da loja.
- `POST /api/licenca/pagar` — `{metodo: 'bci' | 'bim'}` → cobrança NetShop (cartão), 2500 MZN.
- `POST /api/licenca` — `{acao: 'bloquear' | 'reativar'}` (controlo administrativo).
- `POST /api/licenca/recibos/{id}/enviar` — marca o recibo como enviado.
- Webhook NetShop: referências `LIC_…` renovam a licença (mesmo fluxo HMAC dos pedidos `PO_`).

**Porta de licença:** o layout do grupo `(app)` verifica a licença da loja; se não estiver ativa (expirada/bloqueada), renderiza o painel de pagamento em vez do AppShell.

---

## 11. Próximos Passos Sugeridos

1. Criar migrations (Prisma/Drizzle/Knex conforme stack) a partir deste schema.
2. Implementar as views analíticas (secção 21) como materialized views com refresh agendado se o volume for alto — dashboards de BI não devem correr agregações pesadas em tempo real a cada acesso.
3. Definir API REST/GraphQL por módulo: `/produtos`, `/vendas`, `/caixa`, `/stock`, `/publico`, `/pedidos`, `/financeiro`, `/fornecedores`, `/alertas`, `/relatorios`.
4. Configurar crons: expiração de reservas, parcelas vencidas, despesas recorrentes, verificação de stock baixo/validade, geração de alertas.
5. Implementar trigger ou job em near-real-time para `alerta` tipo `stock_baixo` (idealmente disparado logo após cada `movimento_stock`).
6. Seed de dados de teste por `tipo_loja` para validar as duas configurações.

---
*Documento técnico — TECNOINCUBADORA — ShopLink v1.0*
