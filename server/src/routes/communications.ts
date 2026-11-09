import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  campaignCreateSchema,
  campaignListQuerySchema,
  campaignScheduleSchema,
  campaignUpdateSchema,
  consentUpdateSchema,
  logsQuerySchema,
  recipientListQuerySchema,
  reminderRuleSchema,
  settingsUpdateSchema,
  templateCreateSchema,
  templateUpdateSchema,
  triggerUpdateSchema,
} from "../validators/communications.validator";
import {
  deleteReminderRuleHandler,
  getAudit,
  getCampaign,
  getCampaignRecipients,
  getCampaigns,
  getCommunicationsStatus,
  getCustomerPreferences,
  getLogDetail,
  getLogs,
  getReminderRules,
  getSettings,
  getTemplates,
  getTriggers,
  patchCampaign,
  patchCustomerPreferences,
  patchReminderRule,
  patchSettings,
  patchTemplate,
  patchTrigger,
  postCampaign,
  postCampaignCancel,
  postCampaignClone,
  postCampaignPause,
  postCampaignPreview,
  postCampaignResume,
  postCampaignRetry,
  postCampaignSchedule,
  postCampaignStart,
  postReminderRule,
  postTemplate,
} from "../controllers/communications.controller";

const router = Router();

router.use(authenticate, requireRole("owner"));
router.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

router.get("/status", asyncHandler(getCommunicationsStatus));
router.get("/audit", asyncHandler(getAudit));
router.get("/settings", asyncHandler(getSettings));
router.patch("/settings", validate(settingsUpdateSchema), asyncHandler(patchSettings));

router.get("/triggers", asyncHandler(getTriggers));
router.patch("/triggers/:id", validate(triggerUpdateSchema), asyncHandler(patchTrigger));

router.get("/templates", asyncHandler(getTemplates));
router.post("/templates", validate(templateCreateSchema), asyncHandler(postTemplate));
router.patch("/templates/:id", validate(templateUpdateSchema), asyncHandler(patchTemplate));

router.get("/campaigns", validate(campaignListQuerySchema, "query"), asyncHandler(getCampaigns));
router.post("/campaigns", validate(campaignCreateSchema), asyncHandler(postCampaign));
router.get("/campaigns/:id", asyncHandler(getCampaign));
router.patch("/campaigns/:id", validate(campaignUpdateSchema), asyncHandler(patchCampaign));
router.post("/campaigns/:id/preview", asyncHandler(postCampaignPreview));
router.post(
  "/campaigns/:id/schedule",
  validate(campaignScheduleSchema),
  asyncHandler(postCampaignSchedule)
);
router.post("/campaigns/:id/start", asyncHandler(postCampaignStart));
router.post("/campaigns/:id/pause", asyncHandler(postCampaignPause));
router.post("/campaigns/:id/resume", asyncHandler(postCampaignResume));
router.post("/campaigns/:id/cancel", asyncHandler(postCampaignCancel));
router.post("/campaigns/:id/retry", asyncHandler(postCampaignRetry));
router.post("/campaigns/:id/clone", asyncHandler(postCampaignClone));
router.get(
  "/campaigns/:id/recipients",
  validate(recipientListQuerySchema, "query"),
  asyncHandler(getCampaignRecipients)
);

router.get("/logs", validate(logsQuerySchema, "query"), asyncHandler(getLogs));
router.get("/logs/:id", asyncHandler(getLogDetail));

router.get("/customers/:customerId/preferences", asyncHandler(getCustomerPreferences));
router.patch(
  "/customers/:customerId/preferences",
  validate(consentUpdateSchema),
  asyncHandler(patchCustomerPreferences)
);

router.get("/reminder-rules", asyncHandler(getReminderRules));
router.post("/reminder-rules", validate(reminderRuleSchema), asyncHandler(postReminderRule));
router.patch(
  "/reminder-rules/:id",
  validate(reminderRuleSchema),
  asyncHandler(patchReminderRule)
);
router.delete("/reminder-rules/:id", asyncHandler(deleteReminderRuleHandler));

export default router;
