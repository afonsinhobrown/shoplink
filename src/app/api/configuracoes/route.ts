import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;

  const loja = await pool.query(
    `SELECT l.id, l.nome, l.tipo_loja, l.provincia, l.cidade, l.endereco, l.moeda,
            l.modo_pos, l.permite_venda_granel, l.permite_venda_fiado,
            l.controla_lote_validade, l.stock_minimo_ativo,
            l.permite_venda_online, l.permite_reserva, l.slug_publico,
            l.tempo_expiracao_reserva_horas, l.tempo_inatividade,
            t.nome AS empresa, t.email AS email_empresa, t.telefone, t.nuit, t.plano
     FROM loja l JOIN tenant t ON t.id = l.tenant_id
     WHERE l.id = $1`,
    [r.sessao.lojaId]
  );

  const utilizadores = await pool.query(
    `SELECT ul.utilizador_id AS id, ul.papel, u.nome, u.email, u.ativo
     FROM utilizador_loja ul JOIN utilizador u ON u.id = ul.utilizador_id
     WHERE ul.loja_id = $1 ORDER BY u.nome ASC`,
    [r.sessao.lojaId]
  );

  return NextResponse.json({ loja: loja.rows[0], utilizadores: utilizadores.rows });
}

export async function PUT(req: Request) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;
  const body = await req.json();
    const {
      nome, cidade, provincia, endereco, modo_pos, permite_venda_granel, permite_venda_fiado,
      controla_lote_validade, stock_minimo_ativo,
      permite_venda_online, permite_reserva, slug_publico, tempo_expiracao_reserva_horas,
      imposto_padrao, logotipo_url, tempo_inatividade
    } = body;
  
    let slug = null;
    if (slug_publico != null) {
      slug =
        String(slug_publico)
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || null;
    }
  
    try {
      await pool.query(
        `UPDATE loja SET nome = $1, cidade = $2, provincia = $3, endereco = $4,
           modo_pos = $5, permite_venda_granel = $6, permite_venda_fiado = $7,
           controla_lote_validade = $8, stock_minimo_ativo = $9,
           permite_venda_online = $10, permite_reserva = $11, slug_publico = $12,
           tempo_expiracao_reserva_horas = $13, imposto_padrao = $14, logotipo_url = $15,
           tempo_inatividade = $16
         WHERE id = $17`,
        [
          nome, cidade ?? null, provincia ?? null, endereco ?? null,
          modo_pos ?? "rapido",
          permite_venda_granel ?? false, permite_venda_fiado ?? true,
          controla_lote_validade ?? false, stock_minimo_ativo ?? true,
          permite_venda_online ?? false, permite_reserva ?? false, slug,
          Number(tempo_expiracao_reserva_horas) || 24,
          Number(imposto_padrao) || 0, logotipo_url ?? null,
          Number(tempo_inatividade) || 60,
          r.sessao.lojaId,
        ]
      );
    return NextResponse.json({ ok: true, slug_publico: slug });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Este endereço da loja online já está em uso." },
        { status: 409 }
      );
    }
    throw e;
  }
}