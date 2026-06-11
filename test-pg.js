const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bmDCw6WNzLM1@ep-winter-scene-ai2sb9a9-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
client.connect()
  .then(() => { console.log('Connected!'); client.end(); })
  .catch(err => { console.error('Connection error', err.stack); client.end(); });
