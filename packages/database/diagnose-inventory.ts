import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env['DATABASE_URL_DIRECT']!, { prepare: false });

  const counts = await sql`
    SELECT t.name, t.id, COUNT(di.id) as inv_count
    FROM tenants t
    LEFT JOIN dress_inventory di ON di.tenant_id = t.id
    GROUP BY t.id, t.name
    ORDER BY inv_count DESC
    LIMIT 10
  `;
  console.log('Inventory per tenant (top 10):');
  counts.forEach((r: any) => console.log(` ${r.name}: ${r.inv_count}`));

  const [total] = await sql`SELECT COUNT(*) as c FROM dress_inventory`;
  console.log('\nTotal inventory rows:', total.c);

  const idx = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'dress_inventory'
  `;
  console.log('\nIndexes on dress_inventory:');
  idx.forEach((i: any) => console.log(' -', i.indexname, ':', i.indexdef));

  const [tenantCount] = await sql`SELECT COUNT(*) as c FROM tenants`;
  console.log('\nTotal tenants:', tenantCount.c);

  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
