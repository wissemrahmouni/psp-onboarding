-- AlterTable Affiliate: add fields from fichier AFFILIATION (Numero Terminal, RNE, Date Creation, Date Modification, Type Cartes)
ALTER TABLE "Affiliate" ADD COLUMN "numero_terminal" TEXT;
ALTER TABLE "Affiliate" ADD COLUMN "rne" TEXT;
ALTER TABLE "Affiliate" ADD COLUMN "date_creation" TEXT;
ALTER TABLE "Affiliate" ADD COLUMN "date_modification" TEXT;
ALTER TABLE "Affiliate" ADD COLUMN "type_cartes" TEXT;
