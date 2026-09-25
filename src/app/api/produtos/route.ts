import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const categoria = searchParams.get("categoria") ?? "";
  const ativos = searchParams.get("ativos") !== "false";

  const params: unknown[] = [r.sessao.lojaId];
  let sql = `
    SELECT p.id, p.nome, p.codigo_barras, p.sku_interno, p.categoria_id,
           c.nome AS categoria,
           p.fornecedor_id, f.nome AS fornecedor,
           p.tipo_venda, p.unidade_medida,
           p.preco_custo, p.preco_venda,
           p.controla_stock, p.stock_minimo, p.ativo,
           p.disponivel_online, p.descricao_publica, p.isento_imposto,
           COALESCE(v.quantidade_atual, 0) AS stock_atual
    FROM produto p
    LEFT JOIN categoria c ON c.id = p.categoria_id
    LEFT JOIN fornecedor f ON f.id = p.fornecedor_id
    LEFT JOIN vw_stock_atual v ON v.produto_id = p.id
    WHERE p.loja_id = $1`;
  if (ativos) {
    params.push(true);
    sql += ` AND p.ativo = $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (p.nome ILIKE $${params.length} OR COALESCE(p.codigo_barras,'') ILIKE $${params.length} OR COALESCE(p.sku_interno,'') ILIKE $${params.length})`;
  }
  if (categoria) {
    params.push(categoria);
    sql += ` AND p.categoria_id = $${params.length}`;
  }
  sql += ` ORDER BY p.nome ASC`;
  const result = await pool.query(sql, params);
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const body = await req.json();
  const {
    nome,
    codigo_barras,
    sku_interno,
    categoria_id,
    fornecedor_id,
    tipo_venda = "unidade",
    unidade_medida = "un",
    preco_custo = 0,
    preco_venda = 0,
    controla_stock = true,
    stock_minimo = 0,
    disponivel_online = false,
    descricao_publica,
    isento_imposto = false,
  } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome é obrigatório" }, { status: 400 });
  }
  if (Number(preco_venda) <= 0) {
    return NextResponse.json({ error: "O preço de venda deve ser maior que zero" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO produto (loja_id, categoria_id, fornecedor_id, nome, codigo_barras, sku_interno,
                           tipo_venda, unidade_medida, preco_custo, preco_venda, controla_stock, stock_minimo,
                           disponivel_online, descricao_publica, isento_imposto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        r.sessao.lojaId, categoria_id ?? null, fornecedor_id ?? null,
        nome.trim(), codigo_barras ?? null, sku_interno ?? null,
        tipo_venda, unidade_medida, Number(preco_custo) || 0, Number(preco_venda) || 0,
        controla_stock, Number(stock_minimo) || 0,
        disponivel_online ?? false, descricao_publica ?? null, isento_imposto ?? false,
      ]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e: unknown) {
    const msg = (e as { code?: string }).code;
    if (msg === "23505") {
      return NextResponse.json(
        { error: "Já existe um produto com este código de barras" },
        { status: 409 }
      );
    }
    throw e;
  }
}