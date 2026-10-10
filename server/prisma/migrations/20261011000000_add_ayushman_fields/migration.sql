-- Add Ayushman fields to customers
ALTER TABLE "customers"
  ADD COLUMN "isAyushman" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "abhaNumber" TEXT,
  ADD COLUMN "ayushmanLastUsedAt" TIMESTAMP(3),
  ADD COLUMN "ayushmanUsedYear" INTEGER;

-- Add Ayushman fields to bills
ALTER TABLE "bills"
  ADD COLUMN "ayushmanApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ayushmanDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;
