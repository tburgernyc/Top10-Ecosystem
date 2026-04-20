import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env['DATABASE_URL_DIRECT']!, { prepare: false });

  // Check all indexes on dress_inventory
  const indexes = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'dress_inventory'
  `;
  console.log('dress_inventory indexes:');
  indexes.forEach(i => console.log(' -', i.indexname, ':', i.indexdef));

  // Check a few tenant IDs
  const tenantSample = await sql`SELECT id, name FROM tenants WHERE city != '' LIMIT 5`;
  console.log('\nTenant ID samples:');
  tenantSample.forEach(t => console.log(` - ${t.id} | ${t.name}`));

  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
