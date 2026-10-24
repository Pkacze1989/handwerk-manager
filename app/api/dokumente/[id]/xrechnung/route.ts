import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertInvoice, invoiceXmlFromBundle, loadDocument } from "@/lib/document-model";
import { buildXRechnungUbl } from "@/lib/einvoice";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;
  const bundle = await loadDocument(id);
  assertInvoice(bundle.document.type);
  const xml = buildXRechnungUbl(invoiceXmlFromBundle(bundle));
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bundle.document.number}-xrechnung.xml"`,
    },
  });
}
