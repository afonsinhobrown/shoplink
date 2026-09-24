import { requireSessao } from "@/lib/auth";
import { PedidosClient } from "./pedidos-client";

export default async function PedidosPage() {
  await requireSessao();
  return <PedidosClient />;
}