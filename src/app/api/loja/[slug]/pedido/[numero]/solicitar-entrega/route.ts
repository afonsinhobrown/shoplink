import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  createDeliveryOrder,
  getProviderByShopLinkSlug,
  getCityId,
  getCityCoordinates,
} from "@/lib/delivery-api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; numero: string }> }
) {
  const { slug, numero } = await params;

  try {
    const body = await req.json();
    const { deliveryPersonId, deliveryAddress, deliveryLatitude, deliveryLongitude } = body;

    if (!deliveryPersonId || !deliveryAddress) {
      return NextResponse.json(
        { error: "Entregador e endereço de entrega são obrigatórios" },
        { status: 400 }
      );
    }

    const loja = await pool.query(
      `SELECT id, nome, cidade, endereco FROM loja WHERE slug_publico = $1 AND ativo = true`,
      [slug]
    );
    if (loja.rows.length === 0) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    const L = loja.rows[0];

    const pedido = await pool.query(
      `SELECT po.id, po.numero_pedido, po.total, po.tipo_entrega, po.endereco_entrega, po.cliente_online_id
       FROM pedido_online po
       WHERE po.loja_id = $1 AND po.numero_pedido = $2`,
      [L.id, numero]
    );
    if (pedido.rows.length === 0) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }
    const P = pedido.rows[0];

    if (P.tipo_entrega !== "entrega_domicilio") {
      return NextResponse.json(
        { error: "Este pedido não é para entrega em domicílio" },
        { status: 400 }
      );
    }

    const provider = await getProviderByShopLinkSlug(slug);
    if (!provider) {
      return NextResponse.json(
        { error: "Fornecedor não configurado no sistema de entregas" },
        { status: 400 }
      );
    }

    const cityId = getCityId(L.cidade);
    const pickupCoords = getCityCoordinates(provider.cityId) || { lat: -25.9653, lng: 32.5892 };

    const deliveryOrder = await createDeliveryOrder({
      providerId: provider.id,
      clientId: P.cliente_online_id,
      deliveryPersonId,
      pickupAddress: L.endereco || `${L.nome}, ${L.cidade}`,
      pickupLatitude: pickupCoords.lat,
      pickupLongitude: pickupCoords.lng,
      deliveryAddress,
      deliveryLatitude: deliveryLatitude || pickupCoords.lat,
      deliveryLongitude: deliveryLongitude || pickupCoords.lng,
      totalAmount: Number(P.total),
      deliveryFee: 50, // taxa fixa por enquanto
    });

    return NextResponse.json({
      success: true,
      deliveryOrder: {
        id: deliveryOrder.id,
        status: deliveryOrder.status,
        createdAt: deliveryOrder.createdAt,
      },
    });
  } catch (e) {
    console.error("solicitar-entrega erro:", e);
    return NextResponse.json(
      { error: "Falha ao solicitar entrega" },
      { status: 500 }
    );
  }
}