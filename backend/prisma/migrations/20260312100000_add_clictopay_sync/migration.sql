-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN "clictopay_sync_status" TEXT;

-- CreateTable
CREATE TABLE "AffiliateClicToPaySync" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "api_response" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClicToPaySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateClicToPaySync_affiliate_id_environment_key" ON "AffiliateClicToPaySync"("affiliate_id", "environment");

-- AddForeignKey
ALTER TABLE "AffiliateClicToPaySync" ADD CONSTRAINT "AffiliateClicToPaySync_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
