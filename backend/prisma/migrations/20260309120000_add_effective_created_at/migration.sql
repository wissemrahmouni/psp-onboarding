-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN "effective_created_at" TIMESTAMP(3);

-- Backfill: set effective_created_at from date_creation when valid, else createdAt
UPDATE "Affiliate" SET "effective_created_at" = "createdAt";

-- Rows with date_creation as Excel serial (numeric)
UPDATE "Affiliate"
SET "effective_created_at" = TIMESTAMP '1970-01-01' + (("date_creation"::numeric - 25569) * INTERVAL '1 day')
WHERE "date_creation" IS NOT NULL AND TRIM("date_creation") != ''
  AND "date_creation" ~ '^\s*\d+\.?\d*\s*$';

-- Rows with date_creation as ISO format
UPDATE "Affiliate"
SET "effective_created_at" = ("date_creation"::timestamp)
WHERE "date_creation" IS NOT NULL AND TRIM("date_creation") != ''
  AND "date_creation" ~ '^\d{4}-\d{2}-\d{2}'
  AND "date_creation" !~ '^\s*\d+\.?\d*\s*$';
