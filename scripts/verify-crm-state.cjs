const { createRequire } = require('node:module');
const { readFileSync, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const requireProject = createRequire(path.join(process.cwd(), 'package.json'));
const { PrismaClient, Prisma } = requireProject('@prisma/client');
const prisma = new PrismaClient({ log: [] });
(async () => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const agencies = await tx.agency.count();
      const accounts = await tx.account.count({ where: { archivedAt: null } });
      const accountGroups = await tx.account.groupBy({ by: ['type', 'country'], where: { archivedAt: null }, _count: { _all: true } });
      const contacts = await tx.contact.count();
      const opportunities = await tx.opportunity.count();
      const history = await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"');
      const migrations = readdirSync('prisma/migrations', { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => {
        const checksum = createHash('sha256').update(readFileSync(path.join('prisma/migrations', item.name, 'migration.sql'))).digest('hex');
        return { name: item.name, applied: history.some((record) => record.migration_name === item.name && record.checksum === checksum && record.finished_at && !record.rolled_back_at) };
      });
      return { readOnly: true, agencies, activeAccounts: accounts, accountGroups: accountGroups.map((group) => ({ type: group.type, country: group.country, count: group._count._all })), contacts, opportunities, migrations };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    console.log(JSON.stringify(result, null, 2));
    if (result.migrations.some((migration) => !migration.applied)) {
      console.error('Existing migration history did not match; stopping before release.');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(JSON.stringify({ error: 'Read-only CRM verification failed', code: error.code || null, kind: error.constructor?.name || null }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
