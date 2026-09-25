import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

// GET /api/utilizadores
export async function GET() {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;

  try {
    const res = await pool.query(
      `SELECT u.id, u.nome, u.email, ul.papel 
       FROM utilizador u
       JOIN utilizador_loja ul ON ul.utilizador_id = u.id
       WHERE ul.loja_id = $1
       ORDER BY u.nome ASC`,
      [r.sessao.lojaId]
    );
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error("Erro GET utilizadores:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/utilizadores
export async function POST(req: Request) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;

  try {
    const { nome, email, senha, papel } = await req.json();

    if (!nome || !email || !senha || !papel) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }

    // Verificar se já existe (email é unique em utilizador)
    const existente = await pool.query(`SELECT id FROM utilizador WHERE email = $1`, [email]);
    if (existente.rows.length > 0) {
      return NextResponse.json({ error: "Email já registado." }, { status: 400 });
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      
      const resUser = await client.query(
        `INSERT INTO utilizador (tenant_id, nome, email, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
        [r.sessao.tenantId, nome, email, senha_hash]
      );
      const userId = resUser.rows[0].id;

      await client.query(
        `INSERT INTO utilizador_loja (utilizador_id, loja_id, papel) VALUES ($1, $2, $3)`,
        [userId, r.sessao.lojaId, papel]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true, id: userId }, { status: 201 });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Erro POST utilizadores:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
