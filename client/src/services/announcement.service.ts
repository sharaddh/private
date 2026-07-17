import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse, Announcement } from "../types";

class AnnouncementService extends ApiService {
  constructor() {
    super("/api/announcements");
  }

  async getActive(): Promise<ApiResponse<Announcement[]>> {
    return api.get<Announcement[]>(`${this.basePath}/active`);
  }
}

export const announcementService = new AnnouncementService();
