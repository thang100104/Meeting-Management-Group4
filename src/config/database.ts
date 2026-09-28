import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

if (process.env.NODE_ENV === 'development') {
  // @ts-expect-error Prisma query event typing
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    logger.debug(`Prisma Query: ${e.query} [${e.duration}ms]`);
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Successfully connected to PostgreSQL database');
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL database', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected.');
}
