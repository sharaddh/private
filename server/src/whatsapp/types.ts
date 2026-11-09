export type WhatsAppCategory = "utility" | "marketing";
export type ConsentStatus = "unknown" | "opted_in" | "opted_out";
export type ConsentCategory = "transactional" | "marketing";

export type WhatsAppEventKey =
  | "ORDER_CREATED"
  | "ORDER_CONFIRMED"
  | "ORDER_PROCESSING"
  | "ORDER_READY"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_PARTIALLY_RECEIVED"
  | "PAYMENT_BALANCE_DUE"
  | "INVOICE_GENERATED"
  | "MARKETING_CAMPAIGN";

export interface TemplateParameterDefinition {
  key: string;
  label: string;
}

export interface WhatsAppEventDefinition {
  key: WhatsAppEventKey;
  entityType: "order" | "payment" | "invoice" | "receipt" | "customer";
  category: WhatsAppCategory;
  description: string;
  defaultTemplateName: string;
  headerType: "none" | "document";
  parameters: TemplateParameterDefinition[];
  campaignOnly?: boolean;
}

export const WHATSAPP_EVENTS: WhatsAppEventDefinition[] = [
  {
    key: "ORDER_CREATED",
    entityType: "order",
    category: "utility",
    description: "Order has been created and recorded.",
    defaultTemplateName: "kmj_order_confirmation",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "ORDER_CONFIRMED",
    entityType: "order",
    category: "utility",
    description: "Order moved from Draft to Ordered.",
    defaultTemplateName: "kmj_order_confirmation",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "ORDER_PROCESSING",
    entityType: "order",
    category: "utility",
    description: "Order moved to In Lab.",
    defaultTemplateName: "kmj_order_processing",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "ORDER_READY",
    entityType: "order",
    category: "utility",
    description: "Order moved to Ready for pickup/delivery.",
    defaultTemplateName: "kmj_order_ready",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "ORDER_DELIVERED",
    entityType: "order",
    category: "utility",
    description: "Order marked Delivered.",
    defaultTemplateName: "kmj_order_delivered",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "ORDER_CANCELLED",
    entityType: "order",
    category: "utility",
    description: "Order marked Cancelled.",
    defaultTemplateName: "kmj_order_cancelled",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "order_number", label: "Order number" },
    ],
  },
  {
    key: "PAYMENT_RECEIVED",
    entityType: "payment",
    category: "utility",
    description: "A payment was recorded against a bill.",
    defaultTemplateName: "kmj_payment_received",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "amount", label: "Amount received" },
      { key: "bill_number", label: "Bill number" },
    ],
  },
  {
    key: "PAYMENT_PARTIALLY_RECEIVED",
    entityType: "payment",
    category: "utility",
    description: "A partial payment was recorded and a balance remains.",
    defaultTemplateName: "kmj_payment_partial",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "amount", label: "Amount received" },
      { key: "pending_amount", label: "Pending amount" },
      { key: "bill_number", label: "Bill number" },
    ],
  },
  {
    key: "PAYMENT_BALANCE_DUE",
    entityType: "invoice",
    category: "utility",
    description: "A scheduled reminder for an outstanding bill balance.",
    defaultTemplateName: "kmj_payment_reminder",
    headerType: "none",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "pending_amount", label: "Pending amount" },
      { key: "bill_number", label: "Bill number" },
    ],
  },
  {
    key: "INVOICE_GENERATED",
    entityType: "invoice",
    category: "utility",
    description: "Invoice PDF is generated and attached to an approved document template.",
    defaultTemplateName: "kmj_invoice_document",
    headerType: "document",
    parameters: [
      { key: "customer_name", label: "Customer name" },
      { key: "bill_number", label: "Bill number" },
      { key: "total_amount", label: "Total amount" },
    ],
  },
  {
    key: "MARKETING_CAMPAIGN",
    entityType: "customer",
    category: "marketing",
    description: "Opt-in marketing campaign. Uses an approved marketing template.",
    defaultTemplateName: "kmj_promotional_offer",
    headerType: "none",
    parameters: [{ key: "customer_name", label: "Customer name" }],
    campaignOnly: true,
  },
];

export function getEventDefinition(key: string): WhatsAppEventDefinition | undefined {
  return WHATSAPP_EVENTS.find((event) => event.key === key);
}

export interface WhatsAppTemplateParameterMapping {
  key: string;
  source: string;
  [x: string]: string;
}

export interface NotificationEventInput {
  eventType: WhatsAppEventKey;
  entityType: "order" | "payment" | "invoice" | "receipt" | "customer";
  entityId: string;
  customerId: string;
  branchId: string;
  eventVersion?: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
}

export const ORDER_STATUS_EVENT_MAP: Record<string, WhatsAppEventKey> = {
  Ordered: "ORDER_CONFIRMED",
  "In Lab": "ORDER_PROCESSING",
  Ready: "ORDER_READY",
  Delivered: "ORDER_DELIVERED",
  Cancelled: "ORDER_CANCELLED",
};
