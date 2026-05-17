import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.ad.updateMany({
    where: {
      status: 'POSTED'
    },
    data: {
      status: 'ACTIVE'
    }
  });
  console.log(`Updated ${result.count} ads from POSTED to ACTIVE status.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
