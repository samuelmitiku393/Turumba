import cron from 'node-cron';
import prisma from '../prisma/client';

export const startCronJobs = () => {
  // Run every day at midnight server time
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily expiry cron job...');
      const now = new Date();
      
      const result = await prisma.ad.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lte: now
          }
        },
        data: {
          status: 'EXPIRED'
        }
      });
      
      if (result.count > 0) {
        console.log(`Successfully expired ${result.count} ads.`);
      }
    } catch (err) {
      console.error('Error running expiry cron job:', err);
    }
  });
  
  console.log('Cron jobs scheduled.');
};
