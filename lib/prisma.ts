import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;
// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true
// Type definitions
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 10000,
});
const adapter = new PrismaNeon(pool);
const prisma = global.prisma || new PrismaClient({
  adapter,
  transactionOptions: {
    timeout: 30000,
  },
});
if (process.env.NODE_ENV === 'development') global.prisma = prisma;
export default prisma;
