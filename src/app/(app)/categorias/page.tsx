import { requireSessao } from "@/lib/auth";
import { CategoriasClient } from "./categorias-client";

export default async function CategoriasPage() {
  const sessao = await requireSessao();
  return (
    <CategoriasClient
      podeEditar={["dono", "gestor"].includes(sessao.papel)}
    />
  );
}