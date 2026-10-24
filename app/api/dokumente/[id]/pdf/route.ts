import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadDocument } from "@/lib/document-model";
import { renderDocumentPdf } from "@/lib/pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;
  const bundle = await loadDocument(id);
  const pdf = await renderDocumentPdf(bundle);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition(`${bundle.document.number}.pdf`),
    },
  });
}

function disposition(filename: string) {
  const ascii = filename.replace(/[^\w.\-]+/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
