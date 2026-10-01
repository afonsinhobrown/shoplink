# ShopLink — Relatório de Pendentes (continuidade)

Atualizado: 24/09/2026

- **Produção:** https://shoplink-iota.vercel.app
- **Repositório:** https://github.com/afonsinhobrown/shoplink (branch `master`)
- **Deploy:** Vercel, projeto `shoplink` (team *Afonso's projects*). `git push` para `master` faz deploy automático.
- **Acesso:** ver `.env.local` local (não versionado). Demo: `dono@demo.shop` / `demo1234` (loja `mercearia-central`).

---

## ✅ Feito

- **PDV, Produtos, Stock, Vendas, Clientes, Caixa, Fornecedores, Categorias, Configurações.** (base)
- **Loja online / PaySuite:** catálogo público por loja, reservas e compra, webhook HMAC-SHA256 (payment.success / payment.failed), confirmação/conclusão de pedidos (gera venda + movimento de stock), pagamentos M-Pesa/e-Mola/cartão.
- **Licenças:** trial de **10 dias** para lojas novas, pagamento **2.500 MZN** via PaySuite (M-Pesa/e-Mola/cartão no checkout hospedado), renovação **+30 dias** (da data-fim se ativa, senão do dia do pagamento), recibos, gate de licença, painel administrativo, webhook `LIC`.
- **Landing page** da SaaS em `/` (com CTA adaptado à sessão).
- **Alertas** (`/alertas`): stock baixo, lotes a expirar, fiado vencido, pedidos pendentes.
- **Relatórios** (`/relatorios`): gráfico de vendas por dia, top produtos, métodos de pagamento (7/30/90 dias).
- **Gestão Financeira** (`/financeiro`): saldos por conta, lançamentos (criar/listar), DRE mensal, contas a pagar/receber.
- **Env PaySuite** em produção: `PAYSUITE_API_TOKEN`, `PAYSUITE_WEBHOOK_SECRET`.
- **Imagens de produto (Cloudinary):** upload no ecrã de produtos (múltiplas, com `principal` e miniatura), miniaturas nas listas, remoção com `destroy` no CDN. Endpoints `GET/POST/PATCH/DELETE /api/produtos/[id]/imagens` sobre a tabela `produto_imagem`. Env `CLOUDINARY_*` sincronizada na Vercel (Production).
- **Limites de imagem:** 6 por produto, 5000 por loja, 5 MB por ficheiro. Ajustáveis por `CLOUDINARY_MAX_IMAGENS_PRODUTO`, `CLOUDINARY_MAX_IMAGENS_LOJA`, `CLOUDINARY_MAX_BYTES`. A quota é validada **antes** do upload, para não deixar ficheiros órfãos no CDN.

---

## ⏳ Pendentes

### Alta prioridade
- [ ] **Ligar vendas ao financeiro:** criar automaticamente `lancamento_financeiro` (receita) e crédito na conta ao concluir uma venda, para o DRE refletir sem lançamento manual.
- [x] **Registar o webhook na PaySuite:** `https://shoplink-iota.vercel.app/api/webhooks/paysuite` — enviado em cada cobrança via `webhook_url`, por isso não depende da config de conta.
- [ ] **Testar pagamentos reais end-to-end** (M-Pesa, e-Mola, cartão) com números/cartões reais e confirmar o webhook.
- [ ] **UI de lotes/validade:** a tabela `lote_stock` existe, mas não há ecrã para registar lote/validade na **entrada de stock** (essencial para mini supermercado; os alertas de validade dependem disto).

### Média prioridade
- [ ] **Financeiro:** criar/pagar contas a pagar e a receber (com parcelas); transferências entre contas; despesas recorrentes; centros de custo (tabelas já existem, falta UI/API).
- [ ] **Relatórios:** exportar CSV/PDF; relatório por caixa/utilizador; **margem/lucro** (usar `preco_custo`); comparação de períodos.
- [ ] **Alertas:** badge de notificações no menu; envio por e-mail/SMS.
- [ ] **Recibos de licença:** envio por e-mail real (hoje só marca como "enviado"; falta SMTP).
- [ ] **Renovação automática** de licença (hoje é pagamento manual).

### Baixa prioridade
- [ ] Compras a fornecedores (tabelas `compra`/`compra_item` existem, falta UI).
- [ ] Domínio próprio (hoje só `*.vercel.app`).

---

## 🧾 Notas técnicas / ambiente

- **Migrações:** `node scripts/run_migrate.mjs migrate_v2.sql`, `... migrate_v4.sql` e `... migrate_v5.sql` (o runner aceita o ficheiro como argumento). A v4 criou `licenca`/`licenca_pagamento`; a v5 corrigiu o `CHECK` de `licenca_pagamento.metodo` (aceitava só `bci|bim|manual`) e alargou a coluna para `varchar(20)` ( insuficiente para `credit_card`).
- **Licença no gate:** `src/app/(app)/layout.tsx` chama `garantirLicenca()` (trial de 10 dias) antes de decidir; expirada/bloqueada mostra o painel de pagamento.
- **Trial:** `DIAS_TRIAL = 10`; ciclo mensal `DIAS_LICENCA = 30` (`src/lib/licenca.ts`).
- **PaySuite:** `src/lib/paysuite.ts` (prefixos de referência pedidos `PO`, licenças `LIC`; sem `_`/`-` porque a API recusa). A PaySuite **não** aceita telefone no corpo do pedido: M-Pesa/e-Mola usam um contacto E.164 (`contact_id`). Métodos válidos em `POST /payments`: `mpesa`, `emola`, `credit_card`.
- **Lint:** novos client components com `useEffect(() => carregar(), ...)` precisam de `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- **Base de dados:** `DATABASE_URL` (Neon). ⚠️ **Confirmar que é uma DB dedicada ao ShopLink** (não partilhada com outros projetos) e garantir backups.
- **Segredos:** `.env.local` está no `.gitignore` — nunca versionar. As envs de produção estão no Vercel.

---

## 🔑 Variáveis de ambiente (Vercel → Production)

```
DATABASE_URL=...
AUTH_SECRET=...
APP_URL=https://shoplink-iota.vercel.app
PAYSUITE_API_TOKEN=...
PAYSUITE_WEBHOOK_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_URL=...
# opcionais (defaults entre parenteses)
CLOUDINARY_MAX_IMAGENS_PRODUTO=6
CLOUDINARY_MAX_IMAGENS_LOJA=5000
CLOUDINARY_MAX_BYTES=5242880
```
(os valores reais estão no `.env.local` local e no painel do Vercel.)

⚠️ **Ambientes Preview e Development não têm `DATABASE_URL` nem `AUTH_SECRET`** — só Production está configurado. Todos os deployments do histórico são Production, por isso nunca foi bloqueante, mas um Preview disparado por um branch novo vai falhar. Para corrigir: replicar as vars para `preview` (`vercel env add <NOME> preview --project shoplink --sensitive`, feeding por stdin).
