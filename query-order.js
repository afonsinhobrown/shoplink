const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_4LY2caWCfsHM@ep-raspy-mode-agdi8d9m-pooler.c-2.eu-central-1.aws.neon.tech/entregasmoz?sslmode=require&channel_binding=require";

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'Order\''))
  .then(r => { console.table(r.rows); client.end(); })
  .catch(e => { console.error(e); client.end(); });