export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // skip (handled by \n)
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

export function normalizeHeader(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const FIELD_ALIASES: Record<string, string> = {
  sku: "sku",
  barcode: "sku",
  code: "sku",
  itemcode: "sku",
  itemcode2: "sku",
  category: "category",
  categoryname: "category",
  type: "inventoryType",
  inventorytype: "inventoryType",
  itemtype: "inventoryType",
  brand: "brand",
  brandname: "brand",
  model: "model",
  modelname: "model",
  color: "color",
  colour: "color",
  size: "size",
  framesize: "size",
  gender: "gender",
  supplier: "supplier",
  vendor: "supplier",
  qty: "quantity",
  quantity: "quantity",
  stock: "quantity",
  purchaseprice: "purchasePrice",
  cost: "purchasePrice",
  costprice: "purchasePrice",
  cp: "purchasePrice",
  sellingprice: "sellingPrice",
  price: "sellingPrice",
  mrp: "sellingPrice",
  sp: "sellingPrice",
  location: "location",
  description: "description",
  desc: "description",
  note: "description",
  notes: "description",
};

export function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  const result: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const value = (rows[r][i] ?? "").trim();
      if (value === "") return;
      const key = FIELD_ALIASES[h] || (h.length > 0 ? h : null);
      if (key) obj[key] = value;
    });
    result.push(obj);
  }
  return result;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  const csv = toCsv(rows);
  if (!csv) return;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
