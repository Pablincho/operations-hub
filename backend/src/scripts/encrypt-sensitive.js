import '../../loadEnv.js';
import { db } from '../models/index.js';
import { encrypt, isEncrypted } from '../utils/crypto.js';

async function run() {
  await db.authenticate();
  const [entries] = await db.query(`SELECT id, contenido FROM "KnowledgeEntries" WHERE "esSensible" = true`);

  let updated = 0;
  for (const entry of entries) {
    if (!isEncrypted(entry.contenido)) {
      const cifrado = encrypt(entry.contenido);
      await db.query(`UPDATE "KnowledgeEntries" SET contenido = :cifrado WHERE id = :id`, {
        replacements: { cifrado, id: entry.id }
      });
      updated++;
    }
  }

  console.log(`Listo: ${updated} de ${entries.length} entradas cifradas.`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
