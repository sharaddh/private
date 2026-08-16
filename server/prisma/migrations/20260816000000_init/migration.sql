-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "dbName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimetype" TEXT NOT NULL DEFAULT '',
    "metaMessageId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "password" TEXT NOT NULL DEFAULT '',
    "streamPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connecting',
    "lastError" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "address" TEXT,
    "city" TEXT,
    "tags" TEXT[],
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "visits" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitType" TEXT NOT NULL DEFAULT 'new',
    "doctorName" TEXT,
    "shop" TEXT,
    "shopId" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitId" TEXT,
    "rightEye" JSONB NOT NULL DEFAULT '{}',
    "leftEye" JSONB NOT NULL DEFAULT '{}',
    "pd" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitId" TEXT,
    "frame" TEXT,
    "frameBrand" TEXT,
    "frameModel" TEXT,
    "frameColor" TEXT,
    "frameSize" TEXT,
    "framePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lens" TEXT,
    "lensBrand" TEXT,
    "lensType" TEXT,
    "lensIndex" TEXT,
    "lensPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coating" TEXT,
    "coatingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessories" TEXT[],
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "forwardedCount" INTEGER NOT NULL DEFAULT 0,
    "deliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "labAssigned" TEXT,
    "labExpectedDate" TIMESTAMP(3),
    "labRemarks" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "classification" TEXT NOT NULL DEFAULT 'pending',
    "rightLensStatus" TEXT NOT NULL DEFAULT 'pending',
    "leftLensStatus" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "order_stock_items" (
    "_id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "order_stock_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "bills" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitId" TEXT,
    "orderId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "_id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "bill_stock_items" (
    "_id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "bill_stock_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "billId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'Cash',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Specs',
    "inventoryType" TEXT NOT NULL DEFAULT 'spectacles',
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "size" TEXT,
    "gender" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT 'shop',
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "lensIndex" TEXT,
    "lensCoating" TEXT,
    "sphRight" TEXT,
    "cylRight" TEXT,
    "axisRight" TEXT,
    "sphLeft" TEXT,
    "cylLeft" TEXT,
    "axisLeft" TEXT,
    "addPower" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_movement_history" (
    "_id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'adjust',
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movement_history_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "lens_stock" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceNeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantities" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lens_stock_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "address" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "settings" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT 'KMJ Optical',
    "shopAddress" TEXT NOT NULL DEFAULT '',
    "shopPhone" TEXT NOT NULL DEFAULT '',
    "shopEmail" TEXT NOT NULL DEFAULT '',
    "adminWhatsApp" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "todos" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_withdrawals" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "totalQty" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_withdrawals_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_withdrawal_items" (
    "_id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_withdrawal_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "shop_cart_items" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "powerKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_cart_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "shop_lens_withdrawals" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "withdrawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_lens_withdrawals_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "shop_lens_withdrawal_items" (
    "_id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "powerKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "shop_lens_withdrawal_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "brands" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_products" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "brandId" TEXT,
    "brandName" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Specs',
    "inventoryType" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "sizeOptions" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_variants" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT,
    "brandId" TEXT,
    "brandName" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "material" TEXT NOT NULL DEFAULT '',
    "frameShape" TEXT NOT NULL DEFAULT '',
    "frameType" TEXT NOT NULL DEFAULT '',
    "templeSize" TEXT NOT NULL DEFAULT '',
    "bridgeSize" TEXT NOT NULL DEFAULT '',
    "lensWidth" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "image" TEXT NOT NULL DEFAULT '',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "defaultSellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rackId" TEXT,
    "rackLabel" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "lastSoldAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_variants_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "variantId" TEXT,
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "initialQuantity" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "rackId" TEXT,
    "rackLabel" TEXT NOT NULL DEFAULT '',
    "purchaseDate" TIMESTAMP(3),
    "batchNumber" TEXT NOT NULL DEFAULT '',
    "expiryDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'PURCHASE',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL DEFAULT '',
    "lotId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "beforeQuantity" INTEGER NOT NULL DEFAULT 0,
    "afterQuantity" INTEGER NOT NULL DEFAULT 0,
    "referenceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "referenceId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "performedBy" TEXT NOT NULL DEFAULT '',
    "rackId" TEXT,
    "rackLabel" TEXT NOT NULL DEFAULT '',
    "oldRackId" TEXT,
    "newRackId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_movement_lots" (
    "_id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_movement_lots_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "racks" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_count_sessions" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "rackId" TEXT,
    "rackLabel" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedBy" TEXT NOT NULL DEFAULT '',
    "completedBy" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expectedUnits" INTEGER NOT NULL DEFAULT 0,
    "countedUnits" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_count_sessions_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_count_entries" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "countSessionId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL DEFAULT '',
    "brandName" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "lotId" TEXT,
    "expectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "countedQuantity" INTEGER NOT NULL DEFAULT 0,
    "difference" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_count_entries_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_withdrawals_v2" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'Other',
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "totalQty" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_withdrawals_v2_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_withdrawal_v2_items" (
    "_id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_withdrawal_v2_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "inventory_withdrawal_v2_item_lots" (
    "_id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_withdrawal_v2_item_lots_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "warehouse_inventory" (
    "_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Specs',
    "inventoryType" TEXT NOT NULL DEFAULT 'spectacles',
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "size" TEXT,
    "gender" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT 'shop',
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "lensIndex" TEXT,
    "lensCoating" TEXT,
    "sphRight" TEXT,
    "cylRight" TEXT,
    "axisRight" TEXT,
    "sphLeft" TEXT,
    "cylLeft" TEXT,
    "axisLeft" TEXT,
    "addPower" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_inventory_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "warehouse_inventory_movement_history" (
    "_id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'adjust',
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_inventory_movement_history_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "warehouse_lens_stock" (
    "_id" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceNeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantities" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_lens_stock_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "powerKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fogMark" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "withdrawal_items" (
    "_id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "coating" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "powerKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fogMark" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "withdrawal_items_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "fog_marks" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fog_marks_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "_BranchToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BranchToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "messages_branchId_created_at_idx" ON "messages"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "messages_phone_idx" ON "messages"("phone");

-- CreateIndex
CREATE INDEX "messages_metaMessageId_idx" ON "messages"("metaMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_serialNumber_key" ON "cameras"("serialNumber");

-- CreateIndex
CREATE INDEX "customers_branchId_customerId_idx" ON "customers"("branchId", "customerId");

-- CreateIndex
CREATE INDEX "customers_branchId_name_idx" ON "customers"("branchId", "name");

-- CreateIndex
CREATE INDEX "customers_branchId_mobile_idx" ON "customers"("branchId", "mobile");

-- CreateIndex
CREATE INDEX "customers_branchId_totalSpent_idx" ON "customers"("branchId", "totalSpent");

-- CreateIndex
CREATE INDEX "customers_branchId_created_at_idx" ON "customers"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "visits_branchId_customerId_visitDate_idx" ON "visits"("branchId", "customerId", "visitDate");

-- CreateIndex
CREATE INDEX "visits_branchId_visitDate_idx" ON "visits"("branchId", "visitDate");

-- CreateIndex
CREATE INDEX "prescriptions_branchId_customerId_created_at_idx" ON "prescriptions"("branchId", "customerId", "created_at");

-- CreateIndex
CREATE INDEX "prescriptions_branchId_visitId_idx" ON "prescriptions"("branchId", "visitId");

-- CreateIndex
CREATE INDEX "orders_branchId_customerId_created_at_idx" ON "orders"("branchId", "customerId", "created_at");

-- CreateIndex
CREATE INDEX "orders_branchId_status_created_at_idx" ON "orders"("branchId", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_branchId_classification_created_at_idx" ON "orders"("branchId", "classification", "created_at");

-- CreateIndex
CREATE INDEX "orders_branchId_created_at_idx" ON "orders"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "order_stock_items_orderId_idx" ON "order_stock_items"("orderId");

-- CreateIndex
CREATE INDEX "bills_branchId_customerId_created_at_idx" ON "bills"("branchId", "customerId", "created_at");

-- CreateIndex
CREATE INDEX "bills_branchId_pendingAmount_idx" ON "bills"("branchId", "pendingAmount");

-- CreateIndex
CREATE INDEX "bills_branchId_created_at_idx" ON "bills"("branchId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bills_branchId_billNumber_key" ON "bills"("branchId", "billNumber");

-- CreateIndex
CREATE INDEX "bill_items_billId_idx" ON "bill_items"("billId");

-- CreateIndex
CREATE INDEX "bill_stock_items_billId_idx" ON "bill_stock_items"("billId");

-- CreateIndex
CREATE INDEX "payments_branchId_customerId_paymentDate_idx" ON "payments"("branchId", "customerId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_branchId_paymentDate_idx" ON "payments"("branchId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_branchId_billId_idx" ON "payments"("branchId", "billId");

-- CreateIndex
CREATE INDEX "inventory_branchId_category_idx" ON "inventory"("branchId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_branchId_sku_key" ON "inventory"("branchId", "sku");

-- CreateIndex
CREATE INDEX "inventory_movement_history_inventoryId_idx" ON "inventory_movement_history"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "lens_stock_branchId_coating_key" ON "lens_stock"("branchId", "coating");

-- CreateIndex
CREATE INDEX "deliveries_branchId_status_expectedDeliveryDate_idx" ON "deliveries"("branchId", "status", "expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "deliveries_branchId_orderId_idx" ON "deliveries"("branchId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_branchId_key" ON "settings"("branchId");

-- CreateIndex
CREATE INDEX "todos_branchId_idx" ON "todos"("branchId");

-- CreateIndex
CREATE INDEX "inventory_withdrawals_branchId_created_at_idx" ON "inventory_withdrawals"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "inventory_withdrawal_items_withdrawalId_idx" ON "inventory_withdrawal_items"("withdrawalId");

-- CreateIndex
CREATE INDEX "shop_cart_items_branchId_userId_idx" ON "shop_cart_items"("branchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_cart_items_branchId_userId_coating_lensType_powerKey_key" ON "shop_cart_items"("branchId", "userId", "coating", "lensType", "powerKey");

-- CreateIndex
CREATE INDEX "shop_lens_withdrawals_branchId_userId_idx" ON "shop_lens_withdrawals"("branchId", "userId");

-- CreateIndex
CREATE INDEX "shop_lens_withdrawals_branchId_withdrawnAt_idx" ON "shop_lens_withdrawals"("branchId", "withdrawnAt");

-- CreateIndex
CREATE INDEX "shop_lens_withdrawal_items_withdrawalId_idx" ON "shop_lens_withdrawal_items"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "brands_branchId_name_key" ON "brands"("branchId", "name");

-- CreateIndex
CREATE INDEX "inventory_products_branchId_brandId_category_model_idx" ON "inventory_products"("branchId", "brandId", "category", "model");

-- CreateIndex
CREATE INDEX "inventory_products_branchId_brandId_model_idx" ON "inventory_products"("branchId", "brandId", "model");

-- CreateIndex
CREATE INDEX "inventory_variants_branchId_productId_color_idx" ON "inventory_variants"("branchId", "productId", "color");

-- CreateIndex
CREATE INDEX "inventory_variants_branchId_rackId_active_idx" ON "inventory_variants"("branchId", "rackId", "active");

-- CreateIndex
CREATE INDEX "inventory_variants_branchId_brandName_model_idx" ON "inventory_variants"("branchId", "brandName", "model");

-- CreateIndex
CREATE INDEX "inventory_variants_branchId_active_stockQuantity_idx" ON "inventory_variants"("branchId", "active", "stockQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_variants_branchId_sku_key" ON "inventory_variants"("branchId", "sku");

-- CreateIndex
CREATE INDEX "inventory_lots_branchId_variantId_created_at_idx" ON "inventory_lots"("branchId", "variantId", "created_at");

-- CreateIndex
CREATE INDEX "inventory_lots_branchId_variantId_expiryDate_idx" ON "inventory_lots"("branchId", "variantId", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_movements_branchId_variantId_created_at_idx" ON "inventory_movements"("branchId", "variantId", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_branchId_type_created_at_idx" ON "inventory_movements"("branchId", "type", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_branchId_referenceId_idx" ON "inventory_movements"("branchId", "referenceId");

-- CreateIndex
CREATE INDEX "inventory_movements_branchId_created_at_idx" ON "inventory_movements"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movement_lots_movementId_idx" ON "inventory_movement_lots"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "racks_branchId_code_key" ON "racks"("branchId", "code");

-- CreateIndex
CREATE INDEX "inventory_count_sessions_branchId_rackId_idx" ON "inventory_count_sessions"("branchId", "rackId");

-- CreateIndex
CREATE INDEX "inventory_count_sessions_branchId_status_idx" ON "inventory_count_sessions"("branchId", "status");

-- CreateIndex
CREATE INDEX "inventory_count_entries_branchId_countSessionId_variantId_idx" ON "inventory_count_entries"("branchId", "countSessionId", "variantId");

-- CreateIndex
CREATE INDEX "inventory_withdrawals_v2_branchId_created_at_idx" ON "inventory_withdrawals_v2"("branchId", "created_at");

-- CreateIndex
CREATE INDEX "inventory_withdrawals_v2_branchId_by_created_at_idx" ON "inventory_withdrawals_v2"("branchId", "by", "created_at");

-- CreateIndex
CREATE INDEX "inventory_withdrawal_v2_items_withdrawalId_idx" ON "inventory_withdrawal_v2_items"("withdrawalId");

-- CreateIndex
CREATE INDEX "inventory_withdrawal_v2_item_lots_itemId_idx" ON "inventory_withdrawal_v2_item_lots"("itemId");

-- CreateIndex
CREATE INDEX "warehouse_inventory_category_idx" ON "warehouse_inventory"("category");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_inventory_sku_key" ON "warehouse_inventory"("sku");

-- CreateIndex
CREATE INDEX "warehouse_inventory_movement_history_inventoryId_idx" ON "warehouse_inventory_movement_history"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_lens_stock_coating_key" ON "warehouse_lens_stock"("coating");

-- CreateIndex
CREATE INDEX "cart_items_userId_idx" ON "cart_items"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_userId_coating_lensType_powerKey_key" ON "cart_items"("userId", "coating", "lensType", "powerKey");

-- CreateIndex
CREATE INDEX "withdrawals_withdrawnAt_idx" ON "withdrawals"("withdrawnAt");

-- CreateIndex
CREATE INDEX "withdrawal_items_withdrawalId_idx" ON "withdrawal_items"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "fog_marks_name_key" ON "fog_marks"("name");

-- CreateIndex
CREATE INDEX "_BranchToUser_B_index" ON "_BranchToUser"("B");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stock_items" ADD CONSTRAINT "order_stock_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_stock_items" ADD CONSTRAINT "bill_stock_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_history" ADD CONSTRAINT "inventory_movement_history_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_stock" ADD CONSTRAINT "lens_stock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_withdrawal_items" ADD CONSTRAINT "inventory_withdrawal_items_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "inventory_withdrawals"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_cart_items" ADD CONSTRAINT "shop_cart_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_cart_items" ADD CONSTRAINT "shop_cart_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_lens_withdrawals" ADD CONSTRAINT "shop_lens_withdrawals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_lens_withdrawals" ADD CONSTRAINT "shop_lens_withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_lens_withdrawal_items" ADD CONSTRAINT "shop_lens_withdrawal_items_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "shop_lens_withdrawals"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_variants" ADD CONSTRAINT "inventory_variants_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_variants" ADD CONSTRAINT "inventory_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_variants" ADD CONSTRAINT "inventory_variants_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_variants" ADD CONSTRAINT "inventory_variants_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "inventory_variants"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "inventory_variants"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "inventory_lots"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lots" ADD CONSTRAINT "inventory_movement_lots_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "inventory_movements"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_entries" ADD CONSTRAINT "inventory_count_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_entries" ADD CONSTRAINT "inventory_count_entries_countSessionId_fkey" FOREIGN KEY ("countSessionId") REFERENCES "inventory_count_sessions"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_withdrawals_v2" ADD CONSTRAINT "inventory_withdrawals_v2_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_withdrawal_v2_items" ADD CONSTRAINT "inventory_withdrawal_v2_items_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "inventory_withdrawals_v2"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_withdrawal_v2_item_lots" ADD CONSTRAINT "inventory_withdrawal_v2_item_lots_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_withdrawal_v2_items"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_inventory_movement_history" ADD CONSTRAINT "warehouse_inventory_movement_history_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "warehouse_inventory"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_items" ADD CONSTRAINT "withdrawal_items_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawals"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToUser" ADD CONSTRAINT "_BranchToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "branches"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToUser" ADD CONSTRAINT "_BranchToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

