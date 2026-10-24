export type QuoteDraftLine = {
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "ARTICLE" | "SERVICE" | "FREE";
  sourceId?: string;
  sku?: string;
};

export type QuoteDraft = {
  title: string;
  customerId?: string;
  customerName?: string;
  projectHint?: string;
  urgency?: "NIEDRIG" | "NORMAL" | "HOCH" | "NOTDIENST";
  lines: QuoteDraftLine[];
  notes: string[];
  engine: "local" | "llm";
};

export type InvoiceExtract = {
  supplierName?: string;
  number?: string;
  date?: string;
  net?: number;
  tax?: number;
  gross?: number;
  notes: string[];
};
