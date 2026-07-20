export interface InvoiceData {
  billNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
}

export function buildInvoiceMessage(data: InvoiceData): string {
  const lines: string[] = [];

  if (data.shopName) lines.push(`*${data.shopName}*`);
  if (data.shopAddress) lines.push(data.shopAddress);
  if (data.shopPhone) lines.push(`Ph: ${data.shopPhone}`);
  if (lines.length > 0) lines.push("");

  lines.push(`Invoice #${data.billNumber}`);
  lines.push(`Date: ${data.date}`);
  lines.push(`Customer: ${data.customerName}`);
  if (data.customerPhone) lines.push(`Phone: ${data.customerPhone}`);
  lines.push("");

  for (const item of data.items) {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
    lines.push(`${item.description}${qty} - ₹${item.total.toFixed(2)}`);
  }

  lines.push("");
  lines.push(`Subtotal: ₹${data.subtotal.toFixed(2)}`);
  if (data.discount > 0) lines.push(`Discount: -₹${data.discount.toFixed(2)}`);
  lines.push(`*Total: ₹${data.total.toFixed(2)}*`);
  lines.push(`Paid: ₹${data.amountPaid.toFixed(2)}`);
  if (data.balance > 0) lines.push(`*Balance Due: ₹${data.balance.toFixed(2)}*`);

  return lines.join("\n");
}

export function buildPaymentReminderMessage(data: {
  customerName: string;
  balance: number;
  billNumber: string;
  shopName?: string;
}): string {
  const lines: string[] = [];
  if (data.shopName) lines.push(`*${data.shopName}*`);
  lines.push("");
  lines.push(`Hi ${data.customerName},`);
  lines.push(`This is a friendly reminder about your pending balance of *₹${data.balance.toFixed(2)}* for Invoice #${data.billNumber}.`);
  lines.push("");
  lines.push("Please make the payment at your earliest convenience.");
  lines.push("Thank you!");

  return lines.join("\n");
}

export function buildDeliveryReadyMessage(data: {
  customerName: string;
  orderDescription: string;
  shopName?: string;
  shopPhone?: string;
}): string {
  const lines: string[] = [];
  if (data.shopName) lines.push(`*${data.shopName}*`);
  lines.push("");
  lines.push(`Hi ${data.customerName},`);
  lines.push(`Great news! Your order is ready for pickup.`);
  if (data.orderDescription) lines.push(`Order: ${data.orderDescription}`);
  if (data.shopPhone) lines.push(`Contact: ${data.shopPhone}`);
  lines.push("");
  lines.push("Please visit us at your convenience to collect it.");

  return lines.join("\n");
}

export function buildCustomerReminderMessage(data: {
  customerName: string;
  reminderText: string;
  shopName?: string;
}): string {
  const lines: string[] = [];
  if (data.shopName) lines.push(`*${data.shopName}*`);
  lines.push("");
  lines.push(`Hi ${data.customerName},`);
  lines.push(data.reminderText);

  return lines.join("\n");
}
