import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.transaction.findMany();
  console.log(JSON.stringify(txs, null, 2));
}
main().finally(() => prisma.$disconnect());
