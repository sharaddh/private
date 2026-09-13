-- CreateTable
CREATE TABLE "warehouse_demand_lists" (
    "_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "warehouse_demand_lists_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "warehouse_demand_items" (
    "_id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "powerKey" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "warehouse_demand_items_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE INDEX "warehouse_demand_items_listId_idx" ON "warehouse_demand_items"("listId");

-- AddForeignKey
ALTER TABLE "warehouse_demand_items" ADD CONSTRAINT "warehouse_demand_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "warehouse_demand_lists"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
