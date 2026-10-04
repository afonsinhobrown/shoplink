import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAvailableDeliveryPeople, getProviderByShopLinkSlug, getCityId } from "@/lib/delivery-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; numero: string }> }
) {
  const { slug, numero } = await params;

  try {
    const loja = await pool.query(
      `SELECT id, nome, cidade FROM loja WHERE slug_publico = $1 AND ativo = true`,
      [slug]
    );
    if (loja.rows.length === 0) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    const L = loja.rows[0];

    const pedido = await pool.query(
      `SELECT po.id, po.numero_pedido, po.total, po.tipo_entrega, po.endereco_entrega
       FROM pedido_online po
       WHERE po.loja_id = $1 AND po.numero_pedido = $2`,
      [L.id, numero]
    );
    if (pedido.rows.length === 0) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    const cityId = getCityId(L.cidade);
    const deliveryPeople = await getAvailableDeliveryPeople(cityId);

    return NextResponse.json({
      cidade: L.cidade,
      cityId,
      entregadores: deliveryPeople.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicleType: d.vehicleType,
        plateNumber: d.plateNumber,
        vehicleColor: d.vehicleColor,
        rating: d.rating,
        currentLatitude: d.currentLatitude,
        currentLongitude: d.currentLongitude,
        isAvailable: d.isAvailable,
      })),
    });
  } catch (e) {
    console.error("entregadores erro:", e);
    return NextResponse.json({ error: "Falha ao buscar entregadores" }, { status: 500 });
  }
}