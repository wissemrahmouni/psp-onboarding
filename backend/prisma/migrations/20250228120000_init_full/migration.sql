-- Drop old User table if exists (from P1 minimal schema)
DROP TABLE IF EXISTS "User";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BANQUE', 'PAYFAC');
CREATE TYPE "AffiliateStatus" AS ENUM ('CREATED_MERCHANT_MGT', 'AFFILIATION_CREATED', 'TEST_PARAMS_SENT', 'TESTS_VALIDATED', 'PROD_PARAMS_SENT', 'IN_PRODUCTION');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ConfigCategory" AS ENUM ('TEST_DOC', 'PROD_DOC', 'SMTP', 'API', 'GENERAL');

-- CreateTable Bank
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bankId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
ALTER TABLE "User" ADD CONSTRAINT "User_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable Configuration
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" "ConfigCategory",
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Configuration_key_key" ON "Configuration"("key");
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ImportBatch
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "imported_by" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "error_log" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Affiliate
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "merchant_code" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "activity" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "technical_email" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_firstname" TEXT,
    "website" TEXT,
    "currency" TEXT,
    "mcc_code" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankId" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'CREATED_MERCHANT_MGT',
    "test_login" TEXT,
    "test_password_hash" TEXT,
    "test_params_sent_at" TIMESTAMP(3),
    "prod_login" TEXT,
    "prod_password_hash" TEXT,
    "prod_params_sent_at" TIMESTAMP(3),
    "tests_validated_at" TIMESTAMP(3),
    "tests_validated_by" TEXT,
    "import_batch_id" TEXT,
    "created_by" TEXT NOT NULL,
    "affiliation_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Affiliate_merchant_code_key" ON "Affiliate"("merchant_code");
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_tests_validated_by_fkey" FOREIGN KEY ("tests_validated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable AffiliateHistory
CREATE TABLE "AffiliateHistory" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "old_status" "AffiliateStatus",
    "new_status" "AffiliateStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AffiliateHistory" ADD CONSTRAINT "AffiliateHistory_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateHistory" ADD CONSTRAINT "AffiliateHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable TestValidation
CREATE TABLE "TestValidation" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "checked_by" TEXT NOT NULL,
    "api_response" JSONB NOT NULL,
    "transactions_found" INTEGER NOT NULL,
    "criteria_success_status" BOOLEAN NOT NULL,
    "criteria_return_code" BOOLEAN NOT NULL,
    "criteria_auth_number" BOOLEAN NOT NULL,
    "criteria_reference" BOOLEAN NOT NULL,
    "criteria_card_type" BOOLEAN NOT NULL,
    "criteria_scenarios" BOOLEAN NOT NULL,
    "overall_result" BOOLEAN NOT NULL,
    "operator_comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestValidation_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TestValidation" ADD CONSTRAINT "TestValidation_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestValidation" ADD CONSTRAINT "TestValidation_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
