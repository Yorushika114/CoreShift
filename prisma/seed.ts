// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// Prisma 7 requires a driver adapter for SQLite.
// PrismaBetterSqlite3 takes a config object with a `url` field (file: URI or path).
const dbPath = path.resolve(process.cwd(), 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.event.deleteMany();

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  await prisma.event.createMany({
    data: [
      {
        title: '算法课',
        startAt: new Date(y, m, d, 9, 0),
        endAt: new Date(y, m, d, 10, 0),
        sourceText: '今天上午九点到十点算法课',
      },
      {
        title: '组会',
        startAt: new Date(y, m, d, 15, 0),
        reminderAt: new Date(y, m, d, 14, 45),
        sourceText: '下午三点开组会',
      },
      {
        title: '复习',
        startAt: new Date(y, m, d + 2, 20, 0),
        reminderAt: new Date(y, m, d + 2, 19, 45),
      },
      {
        title: '项目答辩',
        startAt: new Date(y, m, d + 5, 14, 0),
        endAt: new Date(y, m, d + 5, 16, 0),
      },
      {
        title: '英语课',
        startAt: new Date(y, m, d - 1, 10, 0),
        endAt: new Date(y, m, d - 1, 11, 30),
      },
    ],
  });
  console.log('✓ Seed complete: 5 events created');
}

main().catch(console.error).finally(() => prisma.$disconnect());
