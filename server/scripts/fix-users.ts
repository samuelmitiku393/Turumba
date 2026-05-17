import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: {
      status: 'ACTIVE'
    }
  });
  console.log(`Updated ${result.count} users to ACTIVE status.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
