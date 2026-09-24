# ShopLink — Esquema de Base de Dados
### Sistema de Gestão para Mercearias e Mini Supermercados
**TECNOINCUBADORA** | PostgreSQL (Neon) | v1.0

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

    ativo           boolean NOT NULL DEFAULT true,
    data_criacao    timestamptz NOT NULL DEFAULT now(),

    UNIQUE(loja_id, codigo_barras)
);

CREATE INDEX idx_produto_loja ON produto(loja_id);
CREATE INDEX idx_produto_codigo_barras ON produto(codigo_barras);

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
    metodo          varchar(20) NOT NULL
                    CHECK (metodo IN ('dinheiro','mpesa','emola','cartao','fiado')),
    valor           numeric(12,2) NOT NULL
);

-- =========================================================
-- 12. COMPRAS (entrada de mercadoria de fornecedores)
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
```

---

## 3. Como a Flexibilidade Mercearia ↔ Mini-Mercado Funciona

| Configuração | Mercearia (típico) | Mini Mercado (típico) |
|---|---|---|
| `modo_pos` | `rapido` (poucos campos, venda ao balcão) | `completo` (código de barras, múltiplos pagamentos) |
| `permite_venda_granel` | `true` (açúcar, arroz a granel) | `false` ou `true` conforme loja |
| `controla_lote_validade` | `false` | `true` (frescos, lacticínios) |
| `stock_minimo_ativo` | opcional | `true` (alertas de reposição) |

Nenhuma tabela muda — apenas o **frontend lê estas flags** e adapta a interface (esconde/mostra campos, valida regras).

---

## 4. Índices e Performance — Notas

- Todas as tabelas transacionais indexadas por `loja_id` (isolamento multi-loja rápido).
- `vw_stock_atual` é uma view calculada — para lojas com alto volume de vendas, considerar **materialized view** com refresh periódico ou trigger de saldo cacheado em `produto.stock_atual_cache`.
- `movimento_stock` funciona como **ledger append-only** — nunca fazer UPDATE/DELETE de quantidade diretamente; sempre novo movimento (auditável).

---

## 5. Sincronização Offline-First (POS)

Recomendação para `venda` e `venda_item`:
1. App POS grava localmente (SQLite/IndexedDB) com UUID gerado no cliente.
2. Ao reconectar, faz `INSERT ... ON CONFLICT (id) DO NOTHING` no Postgres.
3. Campo `origem` + `sincronizado_em` permite auditoria de vendas feitas offline.

---

## 6. Próximos Passos Sugeridos

1. Criar migrations (Prisma/Drizzle/Knex conforme stack) a partir deste schema.
2. Implementar `vw_stock_atual` como materialized view se volume de vendas for alto.
3. Definir API REST/GraphQL por módulo: `/produtos`, `/vendas`, `/caixa`, `/stock`.
4. Seed de dados de teste por `tipo_loja` para validar as duas configurações.

---
*Documento técnico — TECNOINCUBADORA — ShopLink v1.0*
