// Seed de dados demo para o ShopLink.
// Uso:  node scripts/seed.mjs
// Cria uma loja demo com dono, categorias, fornecedores, produtos com stock e clientes.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function carregarEnv() {
  const envFile = join(root, ".env.local");
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const DATABASE_URL = carregarEnv().DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não encontrada em .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const CATEGORIAS = ["Bebidas", "Mercearia", "Laticínios", "Pães e Bolos", "Higiene", "Snacks e Doces"];

const PRODUTOS = [
  { nome: "Coca-Cola 1.5L", categoria: "Bebidas", preco_custo: 52, preco_venda: 85, stock: 48, min: 12 },
  { nome: "Água Mineral 1.5L", categoria: "Bebidas", preco_custo: 20, preco_venda: 40, stock: 60, min: 24 },
  { nome: "Arroz 1kg", categoria: "Mercearia", preco_custo: 55, preco_venda: 78, stock: 90, min: 30 },
  { nome: "Óleo Vegetal 750ml", categoria: "Mercearia", preco_custo: 95, preco_venda: 145, stock: 25, min: 10 },
  { nome: "Açúcar 1kg", categoria: "Mercearia", preco_custo: 75, preco_venda: 100, stock: 0, min: 20 },
  { nome: "Farinha de Trigo 1kg", categoria: "Mercearia", preco_custo: 35, preco_venda: 58, stock: 40, min: 15 },
  { nome: "Leite UHT 1L", categoria: "Laticínios", preco_custo: 70, preco_venda: 98, stock: 30, min: 12 },
  { nome: "Manteiga 500g", categoria: "Laticínios", preco_custo: 120, preco_venda: 165, stock: 15, min: 6 },
  { nome: "Pão de Forma", categoria: "Pães e Bolos", preco_custo: 22, preco_venda: 38, stock: 20, min: 8 },
  { nome: "Sabonete 100g", categoria: "Higiene", preco_custo: 18, preco_venda: 30, stock: 80, min: 30 },
  { nome: "Detergente 500ml", categoria: "Higiene", preco_custo: 65, preco_venda: 95, stock: 35, min: 12 },
  { nome: "Biscoitos", categoria: "Snacks e Doces", preco_custo: 12, preco_venda: 25, stock: 100, min: 40 },
];

const CLIENTES = [
  { nome: "Ana Maria", telefone: "+258840000001", limite_fiado: 5000 },
  { nome: "João Sitoe", telefone: "+258820000002", limite_fiado: 0 },
  { nome: "Maria Muianga", telefone: "+258860000003", limite_fiado: 3000 },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const email = "dono@demo.shop";
    const existente = await client.query(
      "SELECT id FROM utilizador WHERE lower(email) = lower($1)",
      [email]
    );
    if (existente.rows.length > 0) {
      console.log("A loja demo já existe (dono@demo.shop). A correr seed extra de stock/produtos.");
      await client.query("ROLLBACK");
      const res = await seedExtra();
      console.log("Seed extra concluído:", res);
      return;
    }

    const senhaHash = await bcrypt.hash("demo1234", 10);

    const tenant = await client.query(
      "INSERT INTO tenant (nome, email, plano) VALUES ($1, $2, 'basico') RETURNING id",
      ["Loja Demo Lda", email]
    );
    const tenantId = tenant.rows[0].id;

    const loja = await client.query(
      `INSERT INTO loja (tenant_id, nome, tipo_loja, cidade, provincia, endereco)
       VALUES ($1, 'Mercearia Central', 'mercearia', 'Maputo', 'Maputo', 'Av. 24 de Julho 123') RETURNING id`,
      [tenantId]
    );
    const lojaId = loja.rows[0].id;

    const user = await client.query(
      "INSERT INTO utilizador (tenant_id, nome, email, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id",
      [tenantId, "Dono Demo", email, senhaHash]
    );
    const userId = user.rows[0].id;

    await client.query(
      "INSERT INTO utilizador_loja (utilizador_id, loja_id, papel) VALUES ($1, $2, 'dono')",
      [userId, lojaId]
    );

    const catMap = {};
    for (const nome of CATEGORIAS) {
      const r = await client.query(
        "INSERT INTO categoria (loja_id, nome) VALUES ($1, $2) RETURNING id, nome",
        [lojaId, nome]
      );
      catMap[r.rows[0].nome] = r.rows[0].id;
    }

    const fornecedor = await client.query(
      "INSERT INTO fornecedor (loja_id, nome, contacto, email) VALUES ($1, $2, $3, $4) RETURNING id",
      [lojaId, "Distribuidora Nacional", "+25821123456", "vendas@distribuidora.co.mz"]
    );
    const fornecedorId = fornecedor.rows[0].id;

    let produtosCriados = 0;
    for (const p of PRODUTOS) {
      const r = await client.query(
        `INSERT INTO produto (loja_id, categoria_id, fornecedor_id, nome, tipo_venda, unidade_medida,
                             preco_custo, preco_venda, controla_stock, stock_minimo)
         VALUES ($1, $2, $3, $4, 'unidade', 'un', $5, $6, true, $7) RETURNING id`,
        [lojaId, catMap[p.categoria], fornecedorId, p.nome, p.preco_custo, p.preco_venda, p.stock_min]
      );
      if (p.stock > 0) {
        await client.query(
          `INSERT INTO movimento_stock (loja_id, produto_id, utilizador_id, tipo, quantidade, custo_unitario, observacao)
           VALUES ($1, $2, $3, 'entrada', $4, $5, 'Stock inicial')`,
          [lojaId, r.rows[0].id, userId, p.stock, p.preco_custo]
        );
      }
      produtosCriados++;
    }

    for (const c of CLIENTES) {
      await client.query(
        "INSERT INTO cliente (loja_id, nome, telefone, limite_fiado) VALUES ($1, $2, $3, $4)",
        [lojaId, c.nome, c.telefone, c.limite_fiado]
      );
    }

    await client.query(
      `INSERT INTO caixa_sessao (loja_id, utilizador_id, valor_abertura)
       SELECT $1, $2, 1000 WHERE NOT EXISTS (SELECT 1 FROM caixa_sessao WHERE loja_id = $1 AND status = 'aberta')`,
      [lojaId, userId]
    );

    await client.query("COMMIT");
    console.log(
      `Seed concluído: loja "${loja.rows[0].id}", dono "${email}" / senha "demo1234", ${produtosCriados} produtos, ${CLIENTES.length} clientes.`
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedExtra() {
  const res = await pool.query(
    `SELECT l.id FROM loja l JOIN utilizador_loja ul ON ul.loja_id = l.id JOIN utilizador u ON u.id = ul.utilizador_id
     WHERE lower(u.email) = 'dono@demo.shop' LIMIT 1`
  );
  return res.rows.length;
}

main().catch((e) => {
  console.error("Erro no seed:", e);
  process.exit(1);
});