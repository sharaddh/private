import { useCallback } from "react";
import { useApiPost, useApiPut, useApiDelete } from "./useApi";
import { inventoryV2Service } from "../services";
import type {
  AdjustStockResult,
  AddStockResult,
  CompleteCountSessionResult,
  CreateCountSessionResult,
  VariantWithStockResult,
  WithdrawResult,
} from "../services/inventoryV2.service";
import type {
  AddStockInput,
  AdjustStockInput,
  Brand,
  CompleteCountSessionInput,
  CountSession,
  CountSessionDetail,
  CreateBrandInput,
  CreateCountSessionInput,
  CreateProductInput,
  CreateRackInput,
  CreateVariantInput,
  CreateVariantWithStockInput,
  InventoryProduct,
  InventoryVariant,
  Rack,
  UpdateBrandInput,
  UpdateCountEntriesInput,
  UpdateProductInput,
  UpdateRackInput,
  UpdateVariantInput,
  WithdrawalV2,
  WithdrawStockInput,
} from "../types/inventoryV2";

export function useCreateBrand() {
  const { loading, error, reset } = useApiPost<Brand, CreateBrandInput>();
  const create = useCallback((data: CreateBrandInput) => inventoryV2Service.createBrand(data), []);
  return { create, loading, error, reset };
}

export function useUpdateBrand() {
  const { loading, error, reset } = useApiPost<Brand, UpdateBrandInput>();
  const update = useCallback((id: string, data: UpdateBrandInput) => inventoryV2Service.updateBrand(id, data), []);
  return { update, loading, error, reset };
}

export function useCreateProduct() {
  const { loading, error, reset } = useApiPost<InventoryProduct, CreateProductInput>();
  const create = useCallback((data: CreateProductInput) => inventoryV2Service.createProduct(data), []);
  return { create, loading, error, reset };
}

export function useUpdateProduct() {
  const { loading, error, reset } = useApiPost<InventoryProduct, UpdateProductInput>();
  const update = useCallback((id: string, data: UpdateProductInput) => inventoryV2Service.updateProduct(id, data), []);
  return { update, loading, error, reset };
}

export function useDeleteProduct() {
  const { loading, error, reset } = useApiDelete();
  const remove = useCallback((id: string) => inventoryV2Service.deleteProduct(id), []);
  return { remove, loading, error, reset };
}

export function useCreateVariant() {
  const { loading, error, reset } = useApiPost<InventoryVariant, CreateVariantInput>();
  const create = useCallback((data: CreateVariantInput) => inventoryV2Service.createVariant(data), []);
  return { create, loading, error, reset };
}

export function useUpdateVariant() {
  const { loading, error, reset } = useApiPost<InventoryVariant, UpdateVariantInput>();
  const update = useCallback((id: string, data: UpdateVariantInput) => inventoryV2Service.updateVariant(id, data), []);
  return { update, loading, error, reset };
}

export function useDeleteVariant() {
  const { loading, error, reset } = useApiDelete();
  const remove = useCallback((id: string) => inventoryV2Service.deleteVariant(id), []);
  return { remove, loading, error, reset };
}

export function useCreateVariantWithStock() {
  const { loading, error, reset } = useApiPost<VariantWithStockResult, CreateVariantWithStockInput>();
  const create = useCallback((data: CreateVariantWithStockInput) => inventoryV2Service.createVariantWithStock(data), []);
  return { create, loading, error, reset };
}

export function useAddStock() {
  const { loading, error, reset } = useApiPost<AddStockResult, AddStockInput>();
  const add = useCallback((data: AddStockInput) => inventoryV2Service.addStock(data), []);
  return { add, loading, error, reset };
}

export function useAdjustStockV2() {
  const { loading, error, reset } = useApiPut<AdjustStockResult, AdjustStockInput>();
  const adjust = useCallback((id: string, data: AdjustStockInput) => inventoryV2Service.adjustStock(id, data), []);
  return { adjust, loading, error, reset };
}

export function useWithdrawStock() {
  const { loading, error, reset } = useApiPost<WithdrawResult, WithdrawStockInput>();
  const withdraw = useCallback((data: WithdrawStockInput) => inventoryV2Service.withdraw(data), []);
  return { withdraw, loading, error, reset };
}

export function useReverseWithdrawal() {
  const { loading, error, reset } = useApiPost<WithdrawalV2, Record<string, never>>();
  const reverse = useCallback((id: string) => inventoryV2Service.reverseWithdrawal(id), []);
  return { reverse, loading, error, reset };
}

export function useCreateRack() {
  const { loading, error, reset } = useApiPost<Rack, CreateRackInput>();
  const create = useCallback((data: CreateRackInput) => inventoryV2Service.createRack(data), []);
  return { create, loading, error, reset };
}

export function useUpdateRack() {
  const { loading, error, reset } = useApiPost<Rack, UpdateRackInput>();
  const update = useCallback((id: string, data: UpdateRackInput) => inventoryV2Service.updateRack(id, data), []);
  return { update, loading, error, reset };
}

export function useCreateCountSession() {
  const { loading, error, reset } = useApiPost<CreateCountSessionResult, CreateCountSessionInput>();
  const create = useCallback((data: CreateCountSessionInput) => inventoryV2Service.createCountSession(data), []);
  return { create, loading, error, reset };
}

export function useUpdateCountEntries() {
  const { loading, error, reset } = useApiPost<CountSessionDetail, UpdateCountEntriesInput>();
  const update = useCallback((id: string, data: UpdateCountEntriesInput) => inventoryV2Service.updateCountEntries(id, data), []);
  return { update, loading, error, reset };
}

export function useCompleteCountSession() {
  const { loading, error, reset } = useApiPost<CompleteCountSessionResult, CompleteCountSessionInput>();
  const complete = useCallback((id: string, data: CompleteCountSessionInput) => inventoryV2Service.completeCountSession(id, data), []);
  return { complete, loading, error, reset };
}

export function useCancelCountSession() {
  const { loading, error, reset } = useApiPost<CountSession, Record<string, never>>();
  const cancel = useCallback((id: string) => inventoryV2Service.cancelCountSession(id), []);
  return { cancel, loading, error, reset };
}
