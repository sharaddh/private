import { Request, Response } from "express";
import * as inventoryProductService from "../services/inventoryProduct.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { AuthRequest } from "../types";

function thresholdOf(req: Request): number {
  const t = parseInt(req.query.threshold as string, 10);
  return Number.isFinite(t) && t >= 0 ? t : 5;
}

// Dashboard
export async function dashboard(req: Request, res: Response) {
  const data = await inventoryProductService.getDashboard(thresholdOf(req));
  sendSuccess(res, data);
}

// Brands
export async function listBrands(req: Request, res: Response) {
  const data = await inventoryProductService.listBrands(thresholdOf(req));
  sendSuccess(res, data);
}

export async function createBrand(req: Request, res: Response) {
  const data = await inventoryProductService.createBrand(req.body);
  sendCreated(res, data, "Brand created");
}

export async function updateBrand(req: Request, res: Response) {
  const data = await inventoryProductService.updateBrand(req.params.id, req.body);
  sendSuccess(res, data, "Brand updated");
}

export async function getBrandSummary(req: Request, res: Response) {
  const data = await inventoryProductService.getBrandSummary(req.params.id);
  sendSuccess(res, data);
}

// Products
export async function listProducts(req: Request, res: Response) {
  const { brandId, category, gender, search, page, limit } = req.query;
  const data = await inventoryProductService.listProducts({
    brandId: brandId as string | undefined,
    category: category as string | undefined,
    gender: gender as string | undefined,
    search: search as string | undefined,
    page: page as string | undefined,
    limit: limit as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getProduct(req: Request, res: Response) {
  const data = await inventoryProductService.getProductById(req.params.id);
  sendSuccess(res, data);
}

export async function createProduct(req: Request, res: Response) {
  const data = await inventoryProductService.createProduct(req.body);
  sendCreated(res, data, "Product created");
}

export async function updateProduct(req: Request, res: Response) {
  const data = await inventoryProductService.updateProduct(req.params.id, req.body);
  sendSuccess(res, data, "Product updated");
}

export async function archiveProduct(req: Request, res: Response) {
  const data = await inventoryProductService.archiveProduct(req.params.id);
  sendSuccess(res, data, "Product archived");
}

// Variants
export async function listVariants(req: Request, res: Response) {
  const {
    productId,
    brandId,
    category,
    color,
    rackId,
    gender,
    stock,
    threshold,
    search,
    page,
    limit,
  } = req.query;
  const data = await inventoryProductService.listVariants({
    productId: productId as string | undefined,
    brandId: brandId as string | undefined,
    category: category as string | undefined,
    color: color as string | undefined,
    rackId: rackId as string | undefined,
    gender: gender as string | undefined,
    stock: (stock as "all" | "in" | "low" | "out") || "all",
    threshold: threshold as string | undefined,
    search: search as string | undefined,
    page: page as string | undefined,
    limit: limit as string | undefined,
  });
  sendSuccess(res, data);
}

export async function searchVariants(req: Request, res: Response) {
  const query = (req.query.q as string) || "";
  const limit = parseInt(req.query.limit as string, 10);
  const data = await inventoryProductService.searchVariants(
    query,
    Number.isFinite(limit) ? limit : 20
  );
  sendSuccess(res, data);
}

export async function getVariant(req: Request, res: Response) {
  const data = await inventoryProductService.getVariantById(req.params.id);
  sendSuccess(res, data);
}

export async function getVariantBySku(req: Request, res: Response) {
  const data = await inventoryProductService.getVariantBySku(req.params.sku);
  sendSuccess(res, data);
}

export async function createVariant(req: Request, res: Response) {
  const data = await inventoryProductService.createVariant(req.body);
  sendCreated(res, data, "Variant created");
}

export async function updateVariant(req: Request, res: Response) {
  const data = await inventoryProductService.updateVariant(req.params.id, req.body);
  sendSuccess(res, data, "Variant updated");
}

export async function archiveVariant(req: AuthRequest, res: Response) {
  const data = await inventoryProductService.archiveVariant(req.params.id);
  sendSuccess(res, data, "Variant archived");
}

// Racks
export async function listRacks(req: Request, res: Response) {
  const data = await inventoryProductService.listRacks();
  sendSuccess(res, data);
}

export async function createRack(req: Request, res: Response) {
  const data = await inventoryProductService.createRack(req.body);
  sendCreated(res, data, "Rack created");
}

export async function updateRack(req: Request, res: Response) {
  const data = await inventoryProductService.updateRack(req.params.id, req.body);
  sendSuccess(res, data, "Rack updated");
}

export async function getRackItems(req: Request, res: Response) {
  const data = await inventoryProductService.getRackItems(req.params.id);
  sendSuccess(res, data);
}
