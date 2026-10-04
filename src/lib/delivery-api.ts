import { Pool } from "pg";

const DELIVERY_DB_URL = "postgresql://neondb_owner:npg_4LY2caWCfsHM@ep-raspy-mode-agdi8d9m-pooler.c-2.eu-central-1.aws.neon.tech/entregasmoz?sslmode=require&channel_binding=require";

let deliveryPool: Pool | null = null;

function getDeliveryPool(): Pool {
  if (!deliveryPool) {
    deliveryPool = new Pool({
      connectionString: DELIVERY_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return deliveryPool;
}

const CITY_MAP: Record<string, string> = {
  "maputo": "cmmgsavkw00009cdk2efeaiw5",
  "matola": "cmmgsavw100019cdkz9e03d07",
  "xai-xai": "cmmgsaw1a00029cdk0wmqrih3",
  "inhambane": "cmmgsaw6e00039cdkpwl0k84l",
  "beira": "cmmgsawbh00049cdkl3t1088y",
  "chimoio": "cmmgsawgj00059cdks7m8adlw",
  "tete": "cmmgsawlu00069cdk7ydu9hzi",
  "quelimane": "cmmgsawr100079cdkscmxb9py",
  "nampula": "cmmgsaww300089cdkgdafgk13",
  "pemba": "cmmgsax1500099cdkxl3ukaxy",
  "lichinga": "cmmgsax6a000a9cdkcb1x3oxo",
  "boane": "cmmgsaxc5000b9cdko3vozib2",
  "namaacha": "cmmgsaxhn000c9cdk8ep59bb9",
  "moamba": "cmmgsaxmz000d9cdk9ii117uc",
  "magude": "cmmgsaxs0000e9cdk4ghgqfxh",
  "manhica": "cmmgsaxx6000f9cdkv65stjgx",
  "marracuene": "cmmgsay28000g9cdko52gtwye",
  "matutuine": "cmmgsayfm000h9cdkxzroibzo",
  "bela vista": "cmmgsaykr000i9cdkax4d6neb",
};

export function getCityId(cidade: string | null): string {
  if (!cidade) return CITY_MAP["maputo"];
  const normalized = cidade.toLowerCase().trim();
  return CITY_MAP[normalized] || CITY_MAP["maputo"];
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber: string;
  vehicleColor: string;
  isAvailable: boolean;
  currentLatitude: number;
  currentLongitude: number;
  rating: number;
  cityId: string;
}

export async function getAvailableDeliveryPeople(cityId: string): Promise<DeliveryPerson[]> {
  const pool = getDeliveryPool();
  const result = await pool.query(`
    SELECT dp.id, u.name, u.phone, dp."vehicleType", dp."plateNumber", dp."vehicleColor",
           dp."isAvailable", dp."currentLatitude", dp."currentLongitude", dp.rating, dp."cityId"
    FROM "DeliveryPerson" dp
    JOIN "User" u ON u.id = dp."userId"
    WHERE dp."cityId" = $1 AND dp."isAvailable" = true AND u."isActive" = true
    ORDER BY dp.rating DESC
  `, [cityId]);
  return result.rows;
}

export async function createDeliveryOrder(params: {
  providerId: string;
  clientId: string;
  deliveryPersonId: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  totalAmount: number;
  deliveryFee: number;
  notes?: string;
}) {
  const pool = getDeliveryPool();
  const now = new Date().toISOString();
  const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const result = await pool.query(`
    INSERT INTO "Order" (
      id, "providerId", "clientId", "deliveryPersonId",
      "pickupAddress", "pickupLatitude", "pickupLongitude",
      "deliveryAddress", "deliveryLatitude", "deliveryLongitude",
      "totalAmount", "deliveryFee", "platformFee", "providerAmount", "deliveryAmount",
      status, "paymentMethod", "isPaidByClient", "isCashPayment",
      "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING id, status, "createdAt"
  `, [
    id,
    params.providerId,
    params.clientId,
    params.deliveryPersonId,
    params.pickupAddress,
    params.pickupLatitude,
    params.pickupLongitude,
    params.deliveryAddress,
    params.deliveryLatitude,
    params.deliveryLongitude,
    params.totalAmount,
    params.deliveryFee,
    0, // platformFee
    params.totalAmount - params.deliveryFee, // providerAmount
    params.deliveryFee, // deliveryAmount
    "PENDING",
    "CASH", // paymentMethod - cash on delivery
    false, // isPaidByClient - paid on delivery
    true, // isCashPayment
    now,
    now,
  ]);

  return result.rows[0];
}

export async function getProviderByShopLinkSlug(slug: string) {
  const pool = getDeliveryPool();
  const result = await pool.query(`
    SELECT id, "storeName", "cityId", latitude, longitude
    FROM "Provider"
    WHERE id = $1
  `, [`shoplink-${slug}`]);
  return result.rows[0] || null;
}

export function getCityCoordinates(cityId: string): { lat: number; lng: number } | null {
  const cities: Record<string, { lat: number; lng: number }> = {
    "cmmgsavkw00009cdk2efeaiw5": { lat: -25.9653, lng: 32.5892 }, // Maputo
    "cmmgsavw100019cdkz9e03d07": { lat: -25.9622, lng: 32.4589 }, // Matola
    "cmmgsaw1a00029cdk0wmqrih3": { lat: -25.0519, lng: 33.6436 }, // Xai-Xai
    "cmmgsaw6e00039cdkpwl0k84l": { lat: -23.865, lng: 35.3833 }, // Inhambane
    "cmmgsawbh00049cdkl3t1088y": { lat: -19.8436, lng: 34.8389 }, // Beira
    "cmmgsawgj00059cdks7m8adlw": { lat: -19.1164, lng: 33.4833 }, // Chimoio
    "cmmgsawlu00069cdk7ydu9hzi": { lat: -16.1564, lng: 33.5867 }, // Tete
    "cmmgsawr100079cdkscmxb9py": { lat: -17.8786, lng: 36.8883 }, // Quelimane
    "cmmgsaww300089cdkgdafgk13": { lat: -15.1166, lng: 39.2666 }, // Nampula
    "cmmgsax1500099cdkxl3ukaxy": { lat: -12.9776, lng: 40.5167 }, // Pemba
    "cmmgsax6a000a9cdkcb1x3oxo": { lat: -13.3128, lng: 35.2422 }, // Lichinga
    "cmmgsaxc5000b9cdko3vozib2": { lat: -26.0447, lng: 32.3333 }, // Boane
    "cmmgsaxhn000c9cdk8ep59bb9": { lat: -26.0167, lng: 32.0333 }, // Namaacha
    "cmmgsaxmz000d9cdk9ii117uc": { lat: -25.6, lng: 32.25 }, // Moamba
    "cmmgsaxs0000e9cdk4ghgqfxh": { lat: -25.0333, lng: 32.65 }, // Magude
    "cmmgsaxx6000f9cdkv65stjgx": { lat: -25.4117, lng: 32.8067 }, // Manhiça
    "cmmgsay28000g9cdko52gtwye": { lat: -25.7167, lng: 32.6833 }, // Marracuene
    "cmmgsayfm000h9cdkxzroibzo": { lat: -26.2, lng: 32.85 }, // Matutuíne
    "cmmgsaykr000i9cdkax4d6neb": { lat: -26.1, lng: 32.9 }, // Bela Vista
  };
  return cities[cityId] || null;
}

export async function closeDeliveryPool() {
  if (deliveryPool) {
    await deliveryPool.end();
    deliveryPool = null;
  }
}