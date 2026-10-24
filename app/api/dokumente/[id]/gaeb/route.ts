import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadDocument } from "@/lib/document-model";
import { exportGaeb } from "@/lib/gaeb";
import { dateInputValue } from "@/lib/format";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;
  const { document } = await loadDocument(id);
  const xml = exportGaeb({
    dp: document.type === "AUFTRAGSBESTAETIGUNG" ? "84" : "83",
    projectName: document.project?.title || document.customer.name,
    boqName: document.number,
    currency: "EUR",
    date: dateInputValue(document.date),
    items: document.lines
      .filter((line) => line.kind !== "TEXT")
      .map((line, index) => ({
        rno: line.sku && line.sku.includes(".") ? line.sku : `01.${String((index + 1) * 10).padStart(4, "0")}`,
        title: line.title,
        description: line.description ?? undefined,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
      })),
  });
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.number}.x83"`,
    },
  });
}
