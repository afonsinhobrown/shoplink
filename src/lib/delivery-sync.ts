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

interface ShopLinkStore {
  id: string;
  nome: string;
  slugPublico: string;
  cidade: string | null;
  endereco: string | null;
  tenantEmail: string;
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

function getCityId(cidade: string | null): string {
  if (!cidade) return CITY_MAP["maputo"];
  const normalized = cidade.toLowerCase().trim();
  return CITY_MAP[normalized] || CITY_MAP["maputo"];
}

async function getOrCreateProviderUser(email: string, storeName: string) {
  const pool = getDeliveryPool();
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.default.hash("ShopLink2024!", 10);
  const now = new Date().toISOString();
  const userId = `provider-${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const result = await pool.query(`
    INSERT INTO "User" (id, name, email, password, phone, "userType", "isActive", "isBlocked", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      "userType" = EXCLUDED."userType",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
  `, [userId, storeName, email, passwordHash, `+258 84 000 000${Math.floor(Math.random() * 9) + 1}`, "PROVIDER", true, false, now, now]);

  return result.rows[0].id;
}

export async function syncStoreToDelivery(store: ShopLinkStore) {
  const pool = getDeliveryPool();
  const now = new Date().toISOString();
  const providerId = `shoplink-${store.slugPublico}`;

  try {
    const userId = await getOrCreateProviderUser(store.tenantEmail, store.nome);

    const cityId = getCityId(store.cidade);
    const latitude = cityId === CITY_MAP["maputo"] ? -25.9653 : -19.1164;
    const longitude = cityId === CITY_MAP["maputo"] ? 32.5892 : 33.4833;

    await pool.query(`
      INSERT INTO "Provider" (id, "userId", "cityId", "storeName", "storeDescription", "storeImage", category, address, latitude, longitude, "isOpen", "isPremium", "licenseId", "licenseExpiresAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        "storeName" = EXCLUDED."storeName",
        "storeDescription" = EXCLUDED."storeDescription",
        category = EXCLUDED.category,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        "cityId" = EXCLUDED."cityId",
        "isOpen" = EXCLUDED."isOpen",
        "updatedAt" = EXCLUDED."updatedAt"
    `, [
      providerId,
      userId,
      cityId,
      store.nome,
      `Loja ShopLink - ${store.nome}`,
      null,
      "Lojas ShopLink",
      store.endereco || `${store.cidade || "Maputo"}`,
      latitude,
      longitude,
      true,
      false,
      null,
      null,
      now,
      now,
    ]);

    console.log(`[sync] Provider sincronizado: ${providerId} (${store.nome})`);
  } catch (e) {
    console.error(`[sync] Erro ao sincronizar ${store.nome}:`, e);
  }
}

export async function closeDeliveryPool() {
  if (deliveryPool) {
    await deliveryPool.end();
    deliveryPool = null;
  }
}