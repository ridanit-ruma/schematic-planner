import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env on its own. The repository keeps one .env at the
// root, so load that before the config below is evaluated.
for (const file of ['../../.env', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const url = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Declared only when it is set: `prisma generate` needs no connection, so a
  // build in a container or on a fresh checkout must not require a database.
  // Migration commands do need it and fail clearly when it is missing.
  ...(url !== undefined && url !== '' && { datasource: { url } }),
});
