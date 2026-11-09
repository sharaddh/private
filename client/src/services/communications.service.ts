import api from '../api';
import { ApiService } from './base';
import type { ApiResponse } from '../types';

export interface WhatsAppStatusPayload {
  provider?: 'mock' | 'meta';
  providerConfigured?: boolean;
  config?: {
    provider?: 'mock' | 'meta';
    providerConfigured?: boolean;
    missing?: string[];
    webhookPublicUrlSet?: boolean;
    sendEnabled?: boolean;
    campaignSendEnabled?: boolean;
    maxWorkerConcurrency?: number;
    workerPollMs?: number;
  };
  english?: { reviewed: boolean };
  settings?: {
    sendEnabled?: boolean;
    campaignSendEnabled?: boolean;
    killSwitch?: boolean;
    reminderEnabled?: boolean;
    retentionDays?: number;
  };
  effectiveSendEnabled?: boolean;
  effectiveCampaignSendEnabled?: boolean;
  health?: { status?: string; error?: string } | null;
  today?: { submitted?: number; delivered?: number; failed?: number };
  queue?: {
    pending?: number;
    failed?: number;
    lastError?: { lastError?: string; lastErrorClass?: string } | null;
  } | null;
  webhook?: { publicUrlSet?: boolean; appSecretSet?: boolean } | null;
  worker?: {
    inline?: boolean;
    pollMs?: number;
    maxConcurrency?: number;
    queueName?: string;
    windowOpen?: boolean;
    windowEnabled?: boolean;
    windowStart?: number;
    windowEnd?: number;
    windowTimezone?: string;
  } | null;
}

export interface WhatsAppTrigger {
  id: string;
  eventKey: string;
  category: 'utility' | 'marketing';
  enabled: boolean;
  templateId?: string | null;
  template?: {
    id: string;
    metaTemplateName: string;
    languageCode: string;
    localStatus: string;
    category: 'utility' | 'marketing';
  } | null;
}

export interface WhatsAppTemplateMapping {
  id: string;
  eventKey: string;
  metaTemplateName: string;
  languageCode: string;
  category: 'utility' | 'marketing';
  localStatus: string;
  parameterMap: [{ key: string; source: string }];
  headerType?: string;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  description?: string | null;
  purpose: 'marketing' | 'utility';
  templateId: string;
  template?: {
    id: string;
    metaTemplateName: string;
    languageCode: string;
    category: 'utility' | 'marketing';
  } | null;
  audienceFilter?: {
    createdFrom?: string;
    createdTo?: string;
    tags?: string[];
    city?: string;
    minTotalSpent?: number;
    maxTotalSpent?: number;
  };
  status: 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'PAUSED' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'CANCELLED' | 'FAILED';
  audienceMatched?: number;
  eligibleCount?: number;
  skippedCount?: number;
  scheduledAt?: string | null;
  completedAt?: string | null;
  failureCount?: number;
}

export interface MessageLogEntry {
  id: string;
  branchId: string;
  customerId: string;
  campaignId?: string | null;
  templateId?: string | null;
  status: string;
  phoneMasked: string;
  templateName?: string | null;
  languageCode?: string | null;
  category?: string | null;
  contentPreview: string;
  createdAt: string;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  submittedAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  customer?: { id: string; name: string; customerId: string | null } | null;
  campaign?: { id: string; name: string; status: string } | null;
  outbox?: {
    eventType: string;
    entityType: string;
    entityId: string;
    lastErrorClass?: string | null;
  } | null;
}

export interface MessageTimelineEntry {
  id: string;
  at: string;
  label: string;
  error?: string | null;
}

export interface BillingSetting {
  sendEnabled?: boolean;
  campaignSendEnabled?: boolean;
  killSwitch?: boolean;
  reminderEnabled?: boolean;
  retentionDays?: number;
}

export interface TriggerUpdateInput {
  enabled?: boolean;
  templateId?: string | null;
  category?: 'utility' | 'marketing';
  conditions?: Record<string, unknown>;
}

export interface TemplateUpdateInput {
  metaTemplateName?: string;
  languageCode?: string;
  category?: 'utility' | 'marketing';
  localStatus?: string;
  headerType?: string;
  bodyParamCount?: number;
  parameterMap?: Array<{ key: string; source: string }>;
  notes?: string | null;
}

export interface CreateTemplateInput {
  eventKey: string;
  metaTemplateName: string;
  languageCode?: string;
  category?: 'utility' | 'marketing';
  localStatus?: string;
  headerType?: string;
  bodyParamCount?: number;
  parameterMap?: Array<{ key: string; source: string }>;
  notes?: string | null;
}

export interface CampaignAudienceFilter {
  createdFrom?: string;
  createdTo?: string;
  tags?: string[];
  city?: string;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  hasPending?: boolean;
  inactiveDays?: number;
}

export interface ReminderRule {
  id: string;
  name: string;
  enabled: boolean;
  daysAfterBill: number;
  templateId?: string | null;
  template?: {
    id: string;
    metaTemplateName: string;
    languageCode: string;
    localStatus: string;
  } | null;
}

export interface ReminderRuleInput {
  name?: string;
  enabled?: boolean;
  daysAfterBill?: number;
  templateId?: string | null;
}

export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  purpose: 'marketing' | 'utility';
  templateId: string;
  audienceFilter?: CampaignAudienceFilter;
  scheduledAt?: string | null;
  timezone?: string;
  expiresAt?: string | null;
}

export interface ConsentPreference {
  id: string;
  customerId: string;
  phoneE164Masked: string;
  phoneValidationStatus: string;
  consentStatus: 'unknown' | 'opted_in' | 'opted_out';
  transactionalConsent: boolean;
  marketingConsent: boolean;
  consentSource?: string | null;
  consentCapturedAt?: string | null;
  consentEvidence?: string | null;
  optedOutAt?: string | null;
  lastConsentUpdatedAt?: string | null;
}

export interface ConsentAuditEntry {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  source?: string | null;
  evidence?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface CustomerPreferenceView {
  customer: {
    id: string;
    name: string;
    mobile: string | null;
  };
  preference: ConsentPreference;
  audits?: ConsentAuditEntry[];
}

export interface UpdateConsentInput {
  consentStatus: 'unknown' | 'opted_in' | 'opted_out';
  transactionalConsent?: boolean;
  marketingConsent?: boolean;
  source?: string;
  evidence?: string;
}

export interface CampaignPreview {
  campaignId: string;
  matched: number;
  eligible: number;
  skipped: number;
  skipCounts: Record<string, number>;
  sample: Array<{ id: string; customerName: string; phoneMasked?: string }>;
  rendered: [{ key: string; value?: string; template?: string }];
  template?: UniversalTemplateSummary | null;
}

export interface UniversalTemplateSummary {
  id: string;
  eventKey: string;
  metaTemplateName: string;
  languageCode: string;
  category: 'utility' | 'marketing';
  localStatus: string;
}

export interface OutboxRecord {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError?: string | null;
}

export interface DeliveryHealth {
  provider?: 'mock' | 'meta';
  configured?: boolean;
  missing?: string[];
  health?: { status?: string; error?: string } | null;
}

export class CommunicationsService extends ApiService {
  constructor() {
    super('/api/communications');
  }

  async getStatus(): Promise<ApiResponse<WhatsAppStatusPayload>> {
    return api.get<WhatsAppStatusPayload>(`${this.basePath}/status`);
  }

  async getAudit(): Promise<ApiResponse<Record<string, number>>> {
    return api.get<Record<string, number>>(`${this.basePath}/audit`);
  }

  async getSettings(): Promise<ApiResponse<BillingSetting>> {
    return api.get<BillingSetting>(`${this.basePath}/settings`);
  }

  async patchSettings(data: BillingSetting): Promise<ApiResponse<BillingSetting>> {
    return api.patch<BillingSetting>(`${this.basePath}/settings`, data);
  }

  async getTriggers(): Promise<ApiResponse<WhatsAppTrigger[]>> {
    return api.get<WhatsAppTrigger[]>(`${this.basePath}/triggers`);
  }

  async patchTrigger(id: string, data: TriggerUpdateInput): Promise<ApiResponse<WhatsAppTrigger>> {
    return api.patch<WhatsAppTrigger>(`${this.basePath}/triggers/${id}`, data);
  }

  async getTemplates(): Promise<ApiResponse<WhatsAppTemplateMapping[]>> {
    return api.get<WhatsAppTemplateMapping[]>(`${this.basePath}/templates`);
  }

  async createTemplate(data: CreateTemplateInput): Promise<ApiResponse<WhatsAppTemplateMapping>> {
    return api.post<WhatsAppTemplateMapping>(`${this.basePath}/templates`, data);
  }

  async patchTemplate(id: string, data: TemplateUpdateInput): Promise<ApiResponse<WhatsAppTemplateMapping>> {
    return api.patch<WhatsAppTemplateMapping>(`${this.basePath}/templates/${id}`, data);
  }

  async listCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<WhatsAppCampaign[]>> {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return api.get<WhatsAppCampaign[]>(`${this.basePath}/campaigns${qs}`);
  }

  async createCampaign(data: CreateCampaignInput): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns`, data);
  }

  async getCampaign(id: string): Promise<ApiResponse<Record<string, unknown>>> {
    return api.get<Record<string, unknown>>(`${this.basePath}/campaigns/${id}`);
  }

  async previewCampaign(id: string): Promise<ApiResponse<CampaignPreview>> {
    return api.post<CampaignPreview>(`${this.basePath}/campaigns/${id}/preview`, {});
  }

  async scheduleCampaign(
    id: string,
    scheduledAt?: string
  ): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/schedule`, {
      scheduledAt,
    });
  }

  async startCampaign(id: string): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/start`, {});
  }

  async pauseCampaign(id: string): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/pause`, {});
  }

  async resumeCampaign(id: string): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/resume`, {});
  }

  async cancelCampaign(id: string): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/cancel`, {});
  }

  async retryCampaign(id: string): Promise<ApiResponse<{ saturated?: number }>> {
    return api.post<{ saturated?: number }>(`${this.basePath}/campaigns/${id}/retry`, {});
  }

  async cloneCampaign(id: string): Promise<ApiResponse<WhatsAppCampaign>> {
    return api.post<WhatsAppCampaign>(`${this.basePath}/campaigns/${id}/clone`, {});
  }

  async getRecipients(id: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<unknown>> {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return api.get(`${this.basePath}/campaigns/${id}/recipients${qs}`);
  }

  async listLogs(params?: {
    search?: string;
    status?: string;
    eventType?: string;
    category?: 'utility' | 'marketing';
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    sort?: 'createdAt' | 'status';
    order?: 'asc' | 'desc';
  }): Promise<ApiResponse<MessageLogEntry[]>> {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return api.get<MessageLogEntry[]>(`${this.basePath}/logs${qs}`);
  }

  async getLog(id: string): Promise<ApiResponse<MessageLogEntry>> {
    return api.get<MessageLogEntry>(`${this.basePath}/logs/${id}`);
  }

  async getCustomerPreferences(customerId: string): Promise<ApiResponse<CustomerPreferenceView>> {
    return api.get<CustomerPreferenceView>(
      `${this.basePath}/customers/${customerId}/preferences`
    );
  }

  async patchCustomerPreferences(
    customerId: string,
    data: UpdateConsentInput
  ): Promise<ApiResponse<ConsentPreference>> {
    return api.patch<ConsentPreference>(
      `${this.basePath}/customers/${customerId}/preferences`,
      data
    );
  }

  async getReminderRules(): Promise<ApiResponse<ReminderRule[]>> {
    return api.get<ReminderRule[]>(`${this.basePath}/reminder-rules`);
  }

  async createReminderRule(data: ReminderRuleInput): Promise<ApiResponse<ReminderRule>> {
    return api.post<ReminderRule>(`${this.basePath}/reminder-rules`, data);
  }

  async patchReminderRule(
    id: string,
    data: ReminderRuleInput
  ): Promise<ApiResponse<ReminderRule>> {
    return api.patch<ReminderRule>(`${this.basePath}/reminder-rules/${id}`, data);
  }

  async deleteReminderRule(id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`${this.basePath}/reminder-rules/${id}`);
  }
}

export const communicationsService = new CommunicationsService();
