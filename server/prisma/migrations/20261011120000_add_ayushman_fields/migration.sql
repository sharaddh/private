-- AlterTable: Ayushman Bharat Scheme fields on customers
ALTER TABLE "customers" ADD COLUMN "isAyushman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "abhaNumber" TEXT;
ALTER TABLE "customers" ADD COLUMN "ayushmanLastUsedAt" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "ayushmanUsedYear" INTEGER;

-- AlterTable: Ayushman Bharat Scheme fields on bills
ALTER TABLE "bills" ADD COLUMN "ayushmanApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bills" ADD COLUMN "ayushmanDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;
