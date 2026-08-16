#!/usr/bin/env pwsh

# Create 29 commits
git add package-lock.json server/.env.example
git commit -m "chore: update package config files - commit 1"
Write-Host "Commit 1 done"

git add server/package.json server/src/config.ts
git commit -m "chore: update package.json and server config - commit 2"
Write-Host "Commit 2 done"

git add server/src/index.ts server/src/middleware/branch.ts
git commit -m "chore: update server index and middleware - commit 3"
Write-Host "Commit 3 done"

git add server/src/models/bill.ts server/src/models/branch.ts
git commit -m "models: update bill and branch - commit 4"
Write-Host "Commit 4 done"

git add server/src/models/brand.ts server/src/models/camera.ts
git commit -m "models: update brand and camera - commit 5"
Write-Host "Commit 5 done"

git add server/src/models/cart.ts server/src/models/customer.ts
git commit -m "models: update cart and customer - commit 6"
Write-Host "Commit 6 done"

git add server/src/models/delivery.ts server/src/models/fogMark.ts
git commit -m "models: update delivery and fogMark - commit 7"
Write-Host "Commit 7 done"

git add server/src/models/inventory.ts server/src/models/inventoryCount.ts
git commit -m "models: update inventory and inventoryCount - commit 8"
Write-Host "Commit 8 done"

git add server/src/models/inventoryCountEntry.ts server/src/models/inventoryLot.ts
git commit -m "models: update inventoryCountEntry and inventoryLot - commit 9"
Write-Host "Commit 9 done"

git add server/src/models/inventoryMovement.ts server/src/models/inventoryProduct.ts
git commit -m "models: update inventoryMovement and inventoryProduct - commit 10"
Write-Host "Commit 10 done"

git add server/src/models/inventoryVariant.ts server/src/models/inventoryWithdrawal.ts
git commit -m "models: update inventoryVariant and inventoryWithdrawal - commit 11"
Write-Host "Commit 11 done"

git add server/src/models/inventoryWithdrawalV2.ts server/src/models/lensStock.ts
git commit -m "models: update inventoryWithdrawalV2 and lensStock - commit 12"
Write-Host "Commit 12 done"

git add server/src/models/message.ts server/src/models/order.ts
git commit -m "models: update message and order - commit 13"
Write-Host "Commit 13 done"

git add server/src/models/payment.ts server/src/models/prescription.ts
git commit -m "models: update payment and prescription - commit 14"
Write-Host "Commit 14 done"

git add server/src/models/rack.ts server/src/models/settings.ts
git commit -m "models: update rack and settings - commit 15"
Write-Host "Commit 15 done"

git add server/src/models/shopLensCart.ts server/src/models/shopLensWithdrawal.ts
git commit -m "models: update shopLensCart and shopLensWithdrawal - commit 16"
Write-Host "Commit 16 done"

git add server/src/models/todo.ts server/src/models/user.ts
git commit -m "models: update todo and user - commit 17"
Write-Host "Commit 17 done"

git add server/src/models/visit.ts server/src/models/withdrawal.ts
git commit -m "models: update visit and withdrawal - commit 18"
Write-Host "Commit 18 done"

git add server/src/routes/index.ts server/src/services/auth.service.test.ts
git commit -m "routes and tests: update routes and auth tests - commit 19"
Write-Host "Commit 19 done"

git add server/src/services/auth.service.ts server/src/services/bill.service.ts
git commit -m "services: update auth and bill services - commit 20"
Write-Host "Commit 20 done"

git add server/src/services/branch.service.ts server/src/services/camera.service.ts
git commit -m "services: update branch and camera services - commit 21"
Write-Host "Commit 21 done"

git add server/src/services/cart.service.ts server/src/services/customer.service.ts
git commit -m "services: update cart and customer services - commit 22"
Write-Host "Commit 22 done"

git add server/src/services/dashboard.service.ts server/src/services/delivery.service.ts
git commit -m "services: update dashboard and delivery services - commit 23"
Write-Host "Commit 23 done"

git add server/src/services/inventory.service.ts server/src/services/inventoryCount.service.ts
git commit -m "services: update inventory services - commit 24"
Write-Host "Commit 24 done"

git add server/src/services/inventoryProduct.service.ts server/src/services/inventoryStock.service.ts
git commit -m "services: update inventoryProduct and inventoryStock - commit 25"
Write-Host "Commit 25 done"

git add server/src/services/inventoryWithdrawal.service.ts server/src/services/lensStock.service.ts
git commit -m "services: update inventoryWithdrawal and lensStock - commit 26"
Write-Host "Commit 26 done"

git add server/src/services/order.service.ts server/src/services/payment.service.ts
git commit -m "services: update order and payment services - commit 27"
Write-Host "Commit 27 done"

git add server/src/services/prescription.service.ts server/src/services/recalculate.service.ts
git commit -m "services: update prescription and recalculate - commit 28"
Write-Host "Commit 28 done"

git add server/src/services/report.service.ts server/src/services/settings.service.ts server/src/services/shopLensCart.service.ts server/src/services/todo.service.ts server/src/services/visit.service.ts server/src/services/warehouseAggregate.service.ts server/src/services/whatsapp.service.ts server/src/services/workspace.service.ts server/src/types/index.ts server/src/utils/pagination.ts server/src/utils/requestContext.ts server/src/utils/response.ts
git commit -m "services and utils: update remaining services, types, and utils - commit 29"
Write-Host "Commit 29 done"

git rm server/src/utils/branchProxy.ts
git commit -m "chore: remove branchProxy utility - cleanup"

Write-Host "`nAll 29 commits created successfully!"
Write-Host "`nLatest commits:"
git log --oneline -35
