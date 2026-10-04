const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_4LY2caWCfsHM@ep-raspy-mode-agdi8d9m-pooler.c-2.eu-central-1.aws.neon.tech/entregasmoz?sslmode=require&channel_binding=require";

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query('SELECT u.id, u.name, u.email, u.phone, dp."vehicleType", dp."plateNumber", dp."vehicleColor", dp."isAvailable", dp."currentLatitude", dp."currentLongitude", dp.rating, dp."cityId", dp.id as "dpId" FROM "User" u JOIN "DeliveryPerson" dp ON dp."userId" = u.id WHERE u."userType" = \'DELIVERY_PERSON\''))
  .then(r => { console.table(r.rows); client.end(); })
  .catch(e => { console.error(e); client.end(); });