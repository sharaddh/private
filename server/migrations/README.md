# Legacy Data Migration

Place legacy JSON export files in this folder (e.g. `customers.json`, `visits.json`, `prescriptions.json`).

Run migration (example):

```
cd server
npm install
npx ts-node src/migrations/migrate-legacy.ts --dataDir=server/migrations/data
```

The script preserves original timestamps and relationships if the legacy data contains ids and date fields.
