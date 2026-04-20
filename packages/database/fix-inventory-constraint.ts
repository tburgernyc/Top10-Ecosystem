import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env['DATABASE_URL_DIRECT']!, { prepare: false });

  console.log('Dropping legacy unique index dress_inventory_dress_size_idx...');
  await sql`DROP INDEX IF EXISTS dress_inventory_dress_size_idx`;
  console.log('✅ Dropped');

  console.log('Clearing existing inventory rows...');
  const deleted = await sql`DELETE FROM dress_inventory`;
  console.log(`✅ Deleted rows`);

  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
