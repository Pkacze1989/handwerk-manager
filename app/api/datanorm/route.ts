import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { exportDatanorm } from "@/lib/datanorm";

export async function GET() {
  await requireUser();
  const [articles, company] = await Promise.all([
    prisma.article.findMany({ orderBy: { sku: "asc" } }),
    prisma.company.findUnique({ where: { id: "company" } }),
  ]);
  const content = exportDatanorm(
    company?.name ?? "Werkplan",
    articles.map((article) => ({
      action: "A" as const,
      sku: article.sku,
      name: article.name,
      unit: article.unit,
      purchasePrice: article.purchasePrice,
      salesPrice: article.salesPrice,
      vatRate: article.vatRate,
    })),
  );
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="werkplan-katalog.datanorm"',
    },
  });
}
