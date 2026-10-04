const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_4LY2caWCfsHM@ep-raspy-mode-agdi8d9m-pooler.c-2.eu-central-1.aws.neon.tech/entregasmoz?sslmode=require&channel_binding=require";

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query('SELECT enumlabel FROM pg_enum WHERE enumtypid = \'"OrderStatus"\'::regtype'))
  .then(r => { console.log("OrderStatus:"); console.table(r.rows); return client.query('SELECT enumlabel FROM pg_enum WHERE enumtypid = \'"PaymentMethod"\'::regtype'); })
  .then(r => { console.log("PaymentMethod:"); console.table(r.rows); client.end(); })
  .catch(e => { console.error(e); client.end(); });