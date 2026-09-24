# ShopLink — Relatório de Pendentes (continuidade)

Atualizado: 24/09/2026

- **Produção:** https://shoplink-iota.vercel.app
- **Repositório:** https://github.com/afonsinhobrown/shoplink (branch `master`)
- **Deploy:** Vercel, projeto `shoplink` (team *Afonso's projects*). `git push` para `master` faz deploy automático.
- **Acesso:** ver `.env.local` local (não versionado). Demo: `dono@demo.shop` / `demo1234` (loja `mercearia-central`).

---

## ✅ Feito

- **PDV, Produtos, Stock, Vendas, Clientes, Caixa, Fornecedores, Categorias, Configurações.** (base)
- **Loja online / NetShop:** catálogo público por loja, reservas e compra, webhook HMAC, confirmação/conclusão de pedidos (gera venda + movimento de stock), pagamentos M-Pesa/e-Mola/cartão.
- **Licenças:** trial de **10 dias** para lojas novas, pagamento **2.500 MZN** via BCI/BIM, renovação **+30 dias** (da data-fim se ativa, senão do dia do pagamento), recibos, gate de licença, painel administrativo, webhook `LIC_`.
- **Landing page** da SaaS em `/` (com CTA adaptado à sessão).
- **Alertas** (`/alertas`): stock baixo, lotes a expirar, fiado vencido, pedidos pendentes.
- **Relatórios** (`/relatorios`): gráfico de vendas por dia, top produtos, métodos de pagamento (7/30/90 dias).
- **Gestão Financeira** (`/financeiro`): saldos por conta, lançamentos (criar/listar), DRE mensal, contas a pagar/receber.
- **Env NetShop** em produção (valores reais do serviço Render `cafepoint-monolith`).

---

## ⏳ Pendentes

### Alta prioridade
- [ ] **Ligar vendas ao financeiro:** criar automaticamente `lancamento_financeiro` (receita) e crédito na conta ao concluir uma venda, para o DRE refletir sem lançamento manual.
- [ ] **Registar o webhook na NetShop:** `https://shoplink-iota.vercel.app/api/webhooks/netshop`.
- [ ] **Testar pagamentos reais end-to-end** (M-Pesa, e-Mola, cartão BCI/BIM) com números/cartões reais e confirmar o webhook.
- [ ] **UI de lotes/validade:** a tabela `lote_stock` existe, mas não há ecrã para registar lote/validade na **entrada de stock** (essencial para mini supermercado; os alertas de validade dependem disto).

### Média prioridade
- [ ] **Financeiro:** criar/pagar contas a pagar e a receber (com parcelas); transferências entre contas; despesas recorrentes; centros de custo (tabelas já existem, falta UI/API).
- [ ] **Relatórios:** exportar CSV/PDF; relatório por caixa/utilizador; **margem/lucro** (usar `preco_custo`); comparação de períodos.
- [ ] **Alertas:** badge de notificações no menu; envio por e-mail/SMS.
- [ ] **Recibos de licença:** envio por e-mail real (hoje só marca como "enviado"; falta SMTP).
- [ ] **Renovação automática** de licença (hoje é pagamento manual).

### Baixa prioridade
- [ ] Imagens de produto (Cloudinary) — tabela `produto_imagem` existe, falta UI.
- [ ] Compras a fornecedores (tabelas `compra`/`compra_item` existem, falta UI).
- [ ] Domínio próprio (hoje só `*.vercel.app`).

---

## 🧾 Notas técnicas / ambiente

- **Migrações:** `node scripts/run_migrate.mjs migrate_v2.sql` e `... migrate_v4.sql` (o runner aceita o ficheiro como argumento). A v4 criou `licenca`/`licenca_pagamento`.
- **Licença no gate:** `src/app/(app)/layout.tsx` chama `garantirLicenca()` (trial de 10 dias) antes de decidir; expirada/bloqueada mostra o painel de pagamento.
- **Trial:** `DIAS_TRIAL = 10`; ciclo mensal `DIAS_LICENCA = 30` (`src/lib/licenca.ts`).
- **NetShop:** `src/lib/netshop.ts` (prefixo pedidos `PO_`, licenças `LIC_`); sem credenciais → erro claro 502.
- **Lint:** novos client components com `useEffect(() => carregar(), ...)` precisam de `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- **Base de dados:** `DATABASE_URL` (Neon). ⚠️ **Confirmar que é uma DB dedicada ao ShopLink** (não partilhada com outros projetos) e garantir backups.
- **Segredos:** `.env.local` está no `.gitignore` — nunca versionar. As envs de produção estão no Vercel.

---

## 🔑 Variáveis de ambiente (Vercel → Production)

```
DATABASE_URL=...
AUTH_SECRET=...
APP_URL=https://shoplink-iota.vercel.app
NETSHOP_API_KEY=...
NETSHOP_WALLET_ID_MPESA=...
NETSHOP_WALLET_ID_BIM=...
NETSHOP_WALLET_ID_BCI=654027
NETSHOP_WEBHOOK_SECRET=...
```
(os valores reais estão no `.env.local` local e no painel do Vercel.)
