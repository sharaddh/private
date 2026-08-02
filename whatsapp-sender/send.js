#!/usr/bin/env node
/**
 * Standalone lens-list sender for WhatsApp.
 * No Meta/WhatsApp Business API needed.
 *
 * Usage:
 *   node send.js <input.json> [ownerNumber]
 *
 * input.json format (matches a Withdrawal record):
 * {
 *   "username": "rajesh",
 *   "withdrawnAt": "2026-08-02T10:30:00.000Z",
 *   "totalQuantity": 12,
 *   "totalPrice": 3600,
 *   "items": [
 *     { "coating": "HD PX", "lensType": "sph", "powerKey": "-2.00", "quantity": 2, "price": 300, "fogMark": "HD Pixi" },
 *     { "coating": "Blue Cut", "lensType": "compound", "powerKey": "-1.00|-0.50", "quantity": 1, "price": 400, "fogMark": "Super" }
 *   ]
 * }
 *
 * ownerNumber: optional, country code + number with no +/spaces, e.g. 919876543210.
 * Falls back to OWNER_WHATSAPP env var, then a placeholder.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const OWNER_FALLBACK = process.env.OWNER_WHATSAPP || "";

function lensTypeLabel(lensType) {
  if (!lensType) return "";
  return lensType === "compound" ? "Compound" : lensType.toUpperCase();
}

function formatLensPower(powerKey) {
  if (!powerKey) return "";
  if (powerKey.includes("|")) {
    const [sph, cyl] = powerKey.split("|");
    return `${sph} / ${cyl}`;
  }
  return powerKey;
}

function cleanNumber(num) {
  if (!num) return "";
  return String(num).replace(/[^\d]/g, "").replace(/^0+/, "");
}

function buildMessage(data) {
  const lines = [];
  lines.push(`LENS LIST - ${data.username || "Customer"}`);
  lines.push(`Date: ${new Date(data.withdrawnAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  lines.push("");

  const items = data.items || [];
  const pad = (s, n) => String(s).padEnd(n);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const line = [
      `${i + 1}. ${pad(it.coating || "", 12)}`,
      pad(lensTypeLabel(it.lensType), 9),
      pad(formatLensPower(it.powerKey), 14),
      `qty ${it.quantity}`,
    ];
    if (it.fogMark) line.push(`(${it.fogMark})`);
    if (typeof it.price === "number") line.push(`= Rs.${(it.price * it.quantity).toLocaleString("en-IN")}`);
    lines.push(line.join(" "));
  }

  lines.push("");
  lines.push(`Total items: ${data.totalQuantity}`);
  if (typeof data.totalPrice === "number") {
    lines.push(`Total: Rs.${data.totalPrice.toLocaleString("en-IN")}`);
  }
  return lines.join("\n");
}

function main() {
  const inputPath = process.argv[2];
  const ownerArg = process.argv[3];

  if (!inputPath) {
    console.error("Usage: node send.js <input.json> [ownerNumber]");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(inputPath), "utf8");
  const data = JSON.parse(raw);

  const owner = cleanNumber(ownerArg || OWNER_FALLBACK);
  if (!owner) {
    console.error("No owner number. Pass it as arg 2 or set OWNER_WHATSAPP env var.");
    process.exit(1);
  }

  const message = buildMessage(data);
  const encoded = encodeURIComponent(message);
  const link = `https://wa.me/${owner}?text=${encoded}`;

  console.log("--- message preview ---");
  console.log(message);
  console.log("----------------------");
  console.log("WhatsApp link (opens WhatsApp Web/App on this machine):");
  console.log(link);

  try {
    execSync(`start "" "${link}"`, { stdio: "ignore" });
    console.log("Browser opened. Tap Send on your phone's WhatsApp to deliver.");
  } catch (e) {
    console.log("Could not auto-open. Copy/paste the link above into a browser.");
  }
}

main();
