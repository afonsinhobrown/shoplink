import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { id } = await params;
  const body = await req.json();

  const existente = await pool.query(
    "SELECT id FROM produto WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

    const {
      nome,
      codigo_barras,
      sku_interno,
      categoria_id,
      fornecedor_id,
      tipo_venda,
      unidade_medida,
      preco_custo,
      preco_venda,
      controla_stock,
      stock_minimo,
      ativo,
      disponivel_online,
      descricao_publica,
      isento_imposto,
    } = body;
  
    try {
      const result = await pool.query(
        `UPDATE produto SET
           nome = $1, codigo_barras = $2, sku_interno = $3,
           categoria_id = $4, fornecedor_id = $5,
           tipo_venda = $6, unidade_medida = $7,
           preco_custo = $8, preco_venda = $9,
           controla_stock = $10, stock_minimo = $11, ativo = $12,
           disponivel_online = $13, descricao_publica = $14, isento_imposto = $15
         WHERE id = $16 RETURNING id`,
        [
          nome?.trim(), codigo_barras ?? null, sku_interno ?? null,
          categoria_id ?? null, fornecedor_id ?? null,
          tipo_venda ?? "unidade", unidade_medida ?? "un",
          Number(preco_custo) || 0, Number(preco_venda) || 0,
          controla_stock ?? true, Number(stock_minimo) || 0,
          ativo ?? true,
          disponivel_online ?? false, descricao_publica ?? null, isento_imposto ?? false,
          id,
        ]
      );
      return NextResponse.json(result.rows[0]);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Já existe um produto com este código de barras" },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id } = await params;
  const existente = await pool.query(
    "SELECT id FROM produto WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }
  await pool.query("UPDATE produto SET ativo = false WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}