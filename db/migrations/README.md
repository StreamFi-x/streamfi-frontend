# Database migrations

Migrations are applied and tracked by `npm run db:migrate`. See
[docs/database-migrations.md](../../docs/database-migrations.md) for naming,
the `schema_migrations` table, baselining existing environments, deployment
and recovery.

- New files: `npm run db:migrate -- create <name>` creates
  `YYYYMMDDHHMMSS_<name>.sql`.
- Files listed in `legacy-manifest.json` predate the runner and are frozen.
  Do not edit them.
