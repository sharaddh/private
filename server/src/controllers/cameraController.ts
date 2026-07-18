import { Request, Response } from "express";
import * as cameraService from "../services/camera.service";
import { sendSuccess, sendCreated, sendError, sendNotFound } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const cameras = await cameraService.listCameras();
  sendSuccess(res, cameras);
}

export async function get(req: Request, res: Response) {
  const camera = await cameraService.getCamera(req.params.id);
  if (!camera) return sendNotFound(res, "Camera not found");
  sendSuccess(res, camera);
}

export async function create(req: Request, res: Response) {
  try {
    const { name, serialNumber, username, password } = req.body;
    if (!name || !serialNumber) {
      return sendError(res, "Name and serial number are required");
    }
    const camera = await cameraService.addCamera({ name, serialNumber, username, password });
    sendCreated(res, camera);
  } catch (error: any) {
    sendError(res, error.message || "Failed to add camera");
  }
}

export async function update(req: Request, res: Response) {
  try {
    const camera = await cameraService.updateCamera(req.params.id, req.body);
    sendSuccess(res, camera);
  } catch (error: any) {
    sendError(res, error.message || "Failed to update camera");
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await cameraService.removeCamera(req.params.id);
    sendSuccess(res, null, "Camera removed");
  } catch (error: any) {
    sendError(res, error.message || "Failed to remove camera");
  }
}

export async function status(req: Request, res: Response) {
  try {
    const status = await cameraService.getCameraStatus(req.params.id);
    sendSuccess(res, status);
  } catch (error: any) {
    sendError(res, error.message || "Failed to get status");
  }
}
