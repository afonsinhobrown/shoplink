import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

// PUT /api/utilizadores/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;

  try {
    const { id } = await params;
    const { nome, email, papel, senha } = await req.json();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Validar se utilizador pertence a esta loja
      const check = await client.query(
        `SELECT u.id FROM utilizador u JOIN utilizador_loja ul ON ul.utilizador_id = u.id WHERE u.id = $1 AND ul.loja_id = $2`,
        [id, r.sessao.lojaId]
      );
      if (check.rows.length === 0) {
        throw new Error("Não tem permissão para editar este utilizador.");
      }

      await client.query(
        `UPDATE utilizador SET nome = $1, email = $2 WHERE id = $3`,
        [nome, email, id]
      );

      await client.query(
        `UPDATE utilizador_loja SET papel = $1 WHERE utilizador_id = $2 AND loja_id = $3`,
        [papel, id, r.sessao.lojaId]
      );

      if (senha && senha.length >= 6) {
        const senha_hash = await bcrypt.hash(senha, 10);
        await client.query(
          `UPDATE utilizador SET senha_hash = $1 WHERE id = $2`,
          [senha_hash, id]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: e.message || "Erro interno" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Erro PUT utilizadores:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/utilizadores/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;

  try {
    const { id } = await params;
    
    // Evitar que o próprio dono se apague
    if (id === r.sessao.uid) {
      return NextResponse.json({ error: "Não pode apagar a sua própria conta" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Remover o utilizador apenas desta loja (se ele tiver noutras lojas não é afetado, mas neste caso vamos assumir que um utilizador é criado por loja ou tenant)
      await client.query(`DELETE FROM utilizador_loja WHERE utilizador_id = $1 AND loja_id = $2`, [id, r.sessao.lojaId]);
      
      // Se não pertencer a mais nenhuma loja, podemos apagar da tabela principal
      const lojas = await client.query(`SELECT loja_id FROM utilizador_loja WHERE utilizador_id = $1`, [id]);
      if (lojas.rows.length === 0) {
        await client.query(`DELETE FROM utilizador WHERE id = $1`, [id]);
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Erro DELETE utilizadores:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
