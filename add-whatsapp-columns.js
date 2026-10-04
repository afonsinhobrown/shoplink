const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_uiNlMAw0VIG6@ep-old-queen-b2z1ebjp-pooler.c-6.eu-central-1.aws.neon.tech/shoplink?sslmode=require&channel_binding=require";

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query(`
    -- Loja: número de WhatsApp padrão
    ALTER TABLE loja ADD COLUMN IF NOT EXISTS whatsapp_numero text;

    -- Produto: controlo de encomenda e botões
    ALTER TABLE produto ADD COLUMN IF NOT EXISTS sob_encomenda boolean DEFAULT false;
    ALTER TABLE produto ADD COLUMN IF NOT EXISTS mostrar_botao_pagamento boolean DEFAULT true;
    ALTER TABLE produto ADD COLUMN IF NOT EXISTS mostrar_botao_whatsapp boolean DEFAULT false;
  `))
  .then(() => { console.log("Colunas adicionadas com sucesso"); client.end(); })
  .catch(e => { console.error(e); client.end(); });