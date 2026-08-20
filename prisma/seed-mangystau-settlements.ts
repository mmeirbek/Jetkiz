import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

type SettlementSeed = {
  id: string;
  name: string;
  nameRu: string;
  nameKk: string;
  type: string;
  district: string;
  latitude: number;
  longitude: number;
  source: string;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const settlements = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'prisma/data/mangystau-settlements.json'),
    'utf8',
  ),
) as SettlementSeed[];

async function main() {
  for (const settlement of settlements) {
    await prisma.settlement.upsert({
      where: { id: settlement.id },
      update: settlement,
      create: settlement,
    });
  }

  console.log(`Seeded ${settlements.length} Mangystau settlements.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
