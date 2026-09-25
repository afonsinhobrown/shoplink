import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSessao } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ lojaId: string }> }) {
  try {
    const sessao = await requireSessao();
    
    // Apenas o dono principal ou e-mail especifico pode aceder
    const isSuperAdmin = sessao.email === "afonso@example.com" || process.env.SUPER_ADMIN_EMAIL === sessao.email;
    
    if (sessao.papel !== 'dono') {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { lojaId } = await params;

    const result = await pool.query(
      `UPDATE loja SET ativo = NOT ativo WHERE id = $1 RETURNING ativo`,
      [lojaId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ativo: result.rows[0].ativo });
  } catch (error: any) {
    console.error("Erro ao alterar estado da loja:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
