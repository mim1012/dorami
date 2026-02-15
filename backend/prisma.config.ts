import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
