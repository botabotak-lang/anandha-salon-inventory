import { PrismaClient, ServiceCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { taxIncludedFromExcluded } from "../shared/tax.ts";

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.upsert({
    where: { id: "seed-shop-1" },
    update: {},
    create: {
      id: "seed-shop-1",
      name: "Anandah（本店）",
    },
  });

  const hash = await bcrypt.hash("changeme123", 10);

  await prisma.user.upsert({
    where: { email: "owner@anandha.local" },
    update: { passwordHash: hash, shopId: shop.id, name: "オーナー" },
    create: {
      email: "owner@anandha.local",
      passwordHash: hash,
      name: "オーナー",
      shopId: shop.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@anandha.local" },
    update: { passwordHash: hash, shopId: shop.id, name: "スタッフ" },
    create: {
      email: "staff@anandha.local",
      passwordHash: hash,
      name: "スタッフ",
      shopId: shop.id,
    },
  });

  const products: Array<{
    name: string;
    defaultTaxRate: number;
    taxExcluded: number;
    standardCost: number;
    minStock: number;
    category?: string;
  }> = [
    { name: "アロエベラジュース※", defaultTaxRate: 8, taxExcluded: 5800, standardCost: 2900, minStock: 3, category: "関連商品" },
    { name: "ビー・ポーレン（みつばち花粉加工食品）※", defaultTaxRate: 8, taxExcluded: 5800, standardCost: 2900, minStock: 3, category: "関連商品" },
    { name: "アクティブ プロB（乳酸菌類含有加工食品）※", defaultTaxRate: 8, taxExcluded: 7000, standardCost: 3500, minStock: 2, category: "関連商品" },
    { name: "プロテイン（アミノウルトラ）（大豆たんぱく含有食品）※", defaultTaxRate: 8, taxExcluded: 5700, standardCost: 2850, minStock: 5, category: "関連商品" },
    { name: "ビー・プロポリス（プロポリス加工食品）※", defaultTaxRate: 8, taxExcluded: 10300, standardCost: 5150, minStock: 2, category: "関連商品" },
    { name: "アークティックシー（精製魚油含有加工食品）※", defaultTaxRate: 8, taxExcluded: 4000, standardCost: 2000, minStock: 3, category: "関連商品" },
    { name: "ARGI+（アルギニン含有食品）※", defaultTaxRate: 8, taxExcluded: 7600, standardCost: 3800, minStock: 2, category: "関連商品" },
    { name: "ニュートラ Q10", defaultTaxRate: 8, taxExcluded: 4000, standardCost: 2000, minStock: 2, category: "関連商品" },
    { name: "サンプル栄養剤A（仮）", defaultTaxRate: 8, taxExcluded: 3000, standardCost: 1500, minStock: 2, category: "関連商品" },
    { name: "サンプル栄養剤B（仮）", defaultTaxRate: 8, taxExcluded: 3500, standardCost: 1750, minStock: 2, category: "関連商品" },
    { name: "サンプル栄養剤C（仮）", defaultTaxRate: 10, taxExcluded: 2000, standardCost: 1000, minStock: 2, category: "関連商品" },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({
      where: { shopId: shop.id, name: p.name },
    });
    const listPriceTaxIn = taxIncludedFromExcluded(p.taxExcluded, p.defaultTaxRate);
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          defaultTaxRate: p.defaultTaxRate,
          listPriceTaxIn,
          standardCost: p.standardCost,
          minStock: p.minStock,
          category: p.category,
          active: true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          shopId: shop.id,
          name: p.name,
          defaultTaxRate: p.defaultTaxRate,
          listPriceTaxIn,
          standardCost: p.standardCost,
          minStock: p.minStock,
          category: p.category,
        },
      });
    }
  }

  const services: Array<{
    name: string;
    category: ServiceCategory;
    taxRate: number;
    taxExcluded: number;
    standardCost: number;
  }> = [
    { name: "管理費（契約内訳イメージ）", category: ServiceCategory.OTHER, taxRate: 10, taxExcluded: 10000, standardCost: 0 },
    { name: "施術回数券（契約内訳イメージ）", category: ServiceCategory.MIMILO, taxRate: 10, taxExcluded: 2000, standardCost: 0 },
    { name: "材料費（契約内訳イメージ）", category: ServiceCategory.MIMILO, taxRate: 10, taxExcluded: 800, standardCost: 0 },
    { name: "耳つぼダイエット（単発施術イメージ）", category: ServiceCategory.MIMILO, taxRate: 10, taxExcluded: 8000, standardCost: 0 },
    { name: "フェイシャルエステ（例）", category: ServiceCategory.ESTE, taxRate: 10, taxExcluded: 12000, standardCost: 0 },
    { name: "その他メニュー（例）", category: ServiceCategory.OTHER, taxRate: 10, taxExcluded: 5000, standardCost: 0 },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({
      where: { shopId: shop.id, name: s.name },
    });
    const unitPriceTaxIn = taxIncludedFromExcluded(s.taxExcluded, s.taxRate);
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          category: s.category,
          taxRate: s.taxRate,
          unitPriceTaxIn,
          standardCost: s.standardCost,
          active: true,
        },
      });
    } else {
      await prisma.service.create({
        data: {
          shopId: shop.id,
          name: s.name,
          category: s.category,
          taxRate: s.taxRate,
          unitPriceTaxIn,
          standardCost: s.standardCost,
        },
      });
    }
  }

  console.log("Seed OK: shop + 2 users + products + services");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
