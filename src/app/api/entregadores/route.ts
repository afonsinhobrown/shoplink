import { NextResponse } from "next/server";
import { getAvailableDeliveryPeople, getCityId } from "@/lib/delivery-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cidade = searchParams.get("cidade");
  const cityId = getCityId(cidade);

  try {
    const deliveryPeople = await getAvailableDeliveryPeople(cityId);
    return NextResponse.json({
      cityId,
      cidade: cidade || "Todas",
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
        cityId: d.cityId,
      })),
    });
  } catch (e) {
    console.error("entregadores landing erro:", e);
    return NextResponse.json({ error: "Falha ao buscar entregadores" }, { status: 500 });
  }
}