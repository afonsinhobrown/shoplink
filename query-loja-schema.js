const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_uiNlMAw0VIG6@ep-old-queen-b2z1ebjp-pooler.c-6.eu-central-1.aws.neon.tech/shoplink?sslmode=require&channel_binding=require";

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query('SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = \'loja\' ORDER BY ordinal_position'))
  .then(r => { console.table(r.rows); client.end(); })
  .catch(e => { console.error(e); client.end(); });