import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertInvoice, loadDocument } from "@/lib/document-model";
import { renderDocumentPdf } from "@/lib/pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;
  const bundle = await loadDocument(id);
  assertInvoice(bundle.document.type);
  const pdf = await renderDocumentPdf(bundle, { zugferd: true });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bundle.document.number}-zugferd.pdf"`,
    },
  });
}
