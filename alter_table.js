const { Client } = require('pg');
const client = new Client({ connectionString: "postgresql://neondb_owner:npg_uiNlMAw0VIG6@ep-old-queen-b2z1ebjp-pooler.c-6.eu-central-1.aws.neon.tech/shoplink?sslmode=require&channel_binding=require" });

client.connect()
  .then(() => client.query("ALTER TABLE produto ADD COLUMN IF NOT EXISTS link_externo text"))
  .then(() => {
    console.log('Added link_externo to produto');
    return client.end();
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
