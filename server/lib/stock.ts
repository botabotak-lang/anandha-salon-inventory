import type { Prisma, PrismaClient } from "@prisma/client";

export async function stockQtyForProduct(
  tx: PrismaClient | Prisma.TransactionClient,
  productId: string
) {
  const rows = await tx.stockMovement.groupBy({
    by: ["type"],
    where: { productId },
    _sum: { qty: true },
  });
  let q = 0;
  for (const r of rows) {
    const sum = r._sum.qty ?? 0;
    if (r.type === "IN") q += sum;
    else if (r.type === "OUT_SALE" || r.type === "OUT_MANUAL") q -= sum;
    else if (r.type === "ADJUST") q += sum;
  }
  return q;
}
