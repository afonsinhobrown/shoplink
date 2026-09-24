import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { criarSessao } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, senha } = body ?? {};
    if (!email || !senha) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT u.id, u.tenant_id, u.nome, u.email, u.senha_hash, u.ativo,
              ul.loja_id, ul.papel, l.nome AS loja_nome, l.moeda, l.tipo_loja, l.modo_pos
       FROM utilizador u
       JOIN utilizador_loja ul ON ul.utilizador_id = u.id
       JOIN loja l ON l.id = ul.loja_id
       WHERE lower(u.email) = lower($1) AND u.ativo = true
       ORDER BY ul.id`,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(senha, row.senha_hash);
    if (!ok) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    await criarSessao({
      uid: row.id,
      tenantId: row.tenant_id,
      lojaId: row.loja_id,
      lojaNome: row.loja_nome,
      moeda: row.moeda,
      tipoLoja: row.tipo_loja,
      papel: row.papel,
      nome: row.nome,
      email: row.email,
      modoPos: row.modo_pos,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("login erro:", e);
    return NextResponse.json({ error: "Falha ao iniciar sessão" }, { status: 500 });
  }
}