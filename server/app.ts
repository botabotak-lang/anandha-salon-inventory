import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { SaleLineType, StockMovementType } from "@prisma/client";
import { prisma } from "./prisma.js";
import { clearSessionCookie, getSession, setSessionCookie, signSession } from "./lib/auth.js";
import { stockQtyForProduct } from "./lib/stock.js";
import { taxIncludedFromExcluded, taxPartsFromIncluded } from "../shared/tax.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
    allowHeaders: ["Content-Type", "Cookie"],
    exposeHeaders: ["Set-Cookie"],
  })
);

const api = new Hono();

api.use("*", async (c, next) => {
  const path = c.req.path;
  // 親 app で /api にマウントすると path は /api/auth/... になる
  const isLogin = c.req.method === "POST" && path.endsWith("/auth/login");
  const isLogout = c.req.method === "POST" && path.endsWith("/auth/logout");
  if (isLogin || isLogout) return next();
  const s = await getSession(c);
  if (!s) return c.json({ error: "要ログイン" }, 401);
  c.set("session", s);
  return next();
});

type Session = { sub: string; shopId: string; email: string; name: string };

declare module "hono" {
  interface ContextVariableMap {
    session: Session;
  }
}

api.post("/auth/login", async (c) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "入力が不正です" }, 400);
  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
    return c.json({ error: "メールまたはパスワードが違います" }, 401);
  }
  const token = await signSession({
    sub: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
  });
  setSessionCookie(c, token);
  return c.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
});

api.post("/auth/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

api.get("/auth/me", async (c) => {
  const s = c.get("session");
  return c.json({ user: { id: s.sub, email: s.email, name: s.name } });
});

api.post("/auth/change-password", async (c) => {
  const s = c.get("session");
  const body = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "新しいパスワードは8文字以上で入力してください"),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "入力が不正です", details: body.error.flatten() }, 400);

  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) return c.json({ error: "ユーザーが見つかりません" }, 404);

  const ok = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
  if (!ok) return c.json({ error: "現在のパスワードが違います" }, 400);

  const nextHash = await bcrypt.hash(body.data.newPassword, 10);
  await prisma.user.update({
    where: { id: s.sub },
    data: { passwordHash: nextHash },
  });

  return c.json({ ok: true, message: "パスワードを変更しました" });
});

api.get("/products", async (c) => {
  const shopId = c.get("session").shopId;
  const list = await prisma.product.findMany({ where: { shopId }, orderBy: { name: "asc" } });
  return c.json({ products: list });
});

const productIn = z.object({
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  defaultTaxRate: z.number().int().min(0).max(100),
  listPriceTaxIn: z.number().int().min(0).optional(),
  listPriceTaxEx: z.number().int().min(0).optional(),
  standardCost: z.number().int().min(0),
  minStock: z.number().int().min(0),
  active: z.boolean().optional(),
});

api.post("/products", async (c) => {
  const shopId = c.get("session").shopId;
  const parsed = productIn.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です", details: parsed.error.flatten() }, 400);
  const listPriceTaxIn =
    parsed.data.listPriceTaxEx != null
      ? taxIncludedFromExcluded(parsed.data.listPriceTaxEx, parsed.data.defaultTaxRate)
      : (parsed.data.listPriceTaxIn ?? 0);
  const p = await prisma.product.create({
    data: {
      shopId,
      name: parsed.data.name,
      category: parsed.data.category,
      defaultTaxRate: parsed.data.defaultTaxRate,
      listPriceTaxIn,
      standardCost: parsed.data.standardCost,
      minStock: parsed.data.minStock,
      active: parsed.data.active ?? true,
    },
  });
  return c.json({ product: p });
});

api.patch("/products/:id", async (c) => {
  const shopId = c.get("session").shopId;
  const id = c.req.param("id");
  const parsed = productIn.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です" }, 400);
  const existing = await prisma.product.findFirst({ where: { id, shopId } });
  if (!existing) return c.json({ error: "見つかりません" }, 404);
  const defaultTaxRate = parsed.data.defaultTaxRate ?? existing.defaultTaxRate;
  const nextListPriceTaxIn =
    parsed.data.listPriceTaxEx != null
      ? taxIncludedFromExcluded(parsed.data.listPriceTaxEx, defaultTaxRate)
      : parsed.data.listPriceTaxIn;
  const p = await prisma.product.update({
    where: { id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.defaultTaxRate != null ? { defaultTaxRate: parsed.data.defaultTaxRate } : {}),
      ...(nextListPriceTaxIn != null ? { listPriceTaxIn: nextListPriceTaxIn } : {}),
      ...(parsed.data.standardCost != null ? { standardCost: parsed.data.standardCost } : {}),
      ...(parsed.data.minStock != null ? { minStock: parsed.data.minStock } : {}),
      ...(parsed.data.active != null ? { active: parsed.data.active } : {}),
    },
  });
  return c.json({ product: p });
});

api.get("/services", async (c) => {
  const shopId = c.get("session").shopId;
  const list = await prisma.service.findMany({ where: { shopId }, orderBy: { name: "asc" } });
  return c.json({ services: list });
});

const serviceIn = z.object({
  name: z.string().min(1),
  category: z.enum(["MIMILO", "ESTE", "OTHER"]),
  taxRate: z.number().int().min(0).max(100),
  unitPriceTaxIn: z.number().int().min(0).optional(),
  unitPriceTaxEx: z.number().int().min(0).optional(),
  standardCost: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const courseTemplateItemIn = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  unitPriceTaxIn: z.number().int().min(0).optional(),
  unitPriceTaxEx: z.number().int().min(0).optional(),
  taxRate: z.number().int().min(0).max(100),
});

const courseTemplateIn = z.object({
  name: z.string().min(1),
  months: z.number().int().min(1).max(12),
  active: z.boolean().optional(),
  items: z.array(courseTemplateItemIn).min(1),
});

api.post("/services", async (c) => {
  const shopId = c.get("session").shopId;
  const parsed = serviceIn.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です" }, 400);
  const unitPriceTaxIn =
    parsed.data.unitPriceTaxEx != null
      ? taxIncludedFromExcluded(parsed.data.unitPriceTaxEx, parsed.data.taxRate)
      : (parsed.data.unitPriceTaxIn ?? 0);
  const s = await prisma.service.create({
    data: {
      shopId,
      name: parsed.data.name,
      category: parsed.data.category,
      taxRate: parsed.data.taxRate,
      unitPriceTaxIn,
      standardCost: parsed.data.standardCost ?? 0,
      active: parsed.data.active ?? true,
    },
  });
  return c.json({ service: s });
});

api.patch("/services/:id", async (c) => {
  const shopId = c.get("session").shopId;
  const id = c.req.param("id");
  const parsed = serviceIn.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です" }, 400);
  const existing = await prisma.service.findFirst({ where: { id, shopId } });
  if (!existing) return c.json({ error: "見つかりません" }, 404);
  const taxRate = parsed.data.taxRate ?? existing.taxRate;
  const unitPriceTaxIn =
    parsed.data.unitPriceTaxEx != null
      ? taxIncludedFromExcluded(parsed.data.unitPriceTaxEx, taxRate)
      : parsed.data.unitPriceTaxIn;
  const s = await prisma.service.update({
    where: { id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
      ...(parsed.data.category != null ? { category: parsed.data.category } : {}),
      ...(parsed.data.taxRate != null ? { taxRate: parsed.data.taxRate } : {}),
      ...(unitPriceTaxIn != null ? { unitPriceTaxIn } : {}),
      ...(parsed.data.standardCost != null ? { standardCost: parsed.data.standardCost } : {}),
      ...(parsed.data.active != null ? { active: parsed.data.active } : {}),
    },
  });
  return c.json({ service: s });
});

api.get("/course-templates", async (c) => {
  const shopId = c.get("session").shopId;
  const list = await prisma.courseTemplate.findMany({
    where: { shopId },
    orderBy: [{ months: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: { lineOrder: "asc" },
        include: { product: true },
      },
    },
  });
  return c.json({ templates: list });
});

api.post("/course-templates", async (c) => {
  const shopId = c.get("session").shopId;
  const parsed = courseTemplateIn.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です", details: parsed.error.flatten() }, 400);
  const productIds = [...new Set(parsed.data.items.map((x) => x.productId))];
  const exists = await prisma.product.findMany({
    where: { shopId, id: { in: productIds } },
    select: { id: true },
  });
  if (exists.length !== productIds.length) return c.json({ error: "存在しない商品が含まれています" }, 400);
  const created = await prisma.courseTemplate.create({
    data: {
      shopId,
      name: parsed.data.name,
      months: parsed.data.months,
      active: parsed.data.active ?? true,
      items: {
        create: parsed.data.items.map((it, idx) => ({
          productId: it.productId,
          qty: it.qty,
          unitPriceTaxIn:
            it.unitPriceTaxEx != null
              ? taxIncludedFromExcluded(it.unitPriceTaxEx, it.taxRate)
              : (it.unitPriceTaxIn ?? 0),
          taxRate: it.taxRate,
          lineOrder: idx,
        })),
      },
    },
    include: { items: { orderBy: { lineOrder: "asc" }, include: { product: true } } },
  });
  return c.json({ template: created });
});

api.patch("/course-templates/:id", async (c) => {
  const shopId = c.get("session").shopId;
  const id = c.req.param("id");
  const parsed = courseTemplateIn.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です", details: parsed.error.flatten() }, 400);
  const existingTemplate = await prisma.courseTemplate.findFirst({ where: { id, shopId } });
  if (!existingTemplate) return c.json({ error: "見つかりません" }, 404);
  const productIds = [...new Set(parsed.data.items.map((x) => x.productId))];
  const exists = await prisma.product.findMany({
    where: { shopId, id: { in: productIds } },
    select: { id: true },
  });
  if (exists.length !== productIds.length) return c.json({ error: "存在しない商品が含まれています" }, 400);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.courseTemplateItem.deleteMany({ where: { courseTemplateId: id } });
    await tx.courseTemplate.update({
      where: { id },
      data: {
        name: parsed.data.name,
        months: parsed.data.months,
        active: parsed.data.active ?? true,
        items: {
          create: parsed.data.items.map((it, idx) => ({
            productId: it.productId,
            qty: it.qty,
            unitPriceTaxIn:
              it.unitPriceTaxEx != null
                ? taxIncludedFromExcluded(it.unitPriceTaxEx, it.taxRate)
                : (it.unitPriceTaxIn ?? 0),
            taxRate: it.taxRate,
            lineOrder: idx,
          })),
        },
      },
    });
    return tx.courseTemplate.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { lineOrder: "asc" }, include: { product: true } } },
    });
  });
  return c.json({ template: updated });
});

api.get("/stock/summary", async (c) => {
  const shopId = c.get("session").shopId;
  const products = await prisma.product.findMany({
    where: { shopId, active: true },
    orderBy: { name: "asc" },
  });
  const out: { product: (typeof products)[0]; qty: number; alert: boolean }[] = [];
  for (const p of products) {
    const qty = await stockQtyForProduct(prisma, p.id);
    out.push({ product: p, qty, alert: qty <= p.minStock });
  }
  return c.json({ rows: out });
});

api.get("/stock/alerts", async (c) => {
  const shopId = c.get("session").shopId;
  const products = await prisma.product.findMany({ where: { shopId, active: true } });
  const alerts: { productId: string; name: string; qty: number; minStock: number }[] = [];
  for (const p of products) {
    const qty = await stockQtyForProduct(prisma, p.id);
    if (qty <= p.minStock) alerts.push({ productId: p.id, name: p.name, qty, minStock: p.minStock });
  }
  alerts.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return c.json({ alerts });
});

const stockInBody = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  reason: z.string().optional(),
});

api.post("/stock/in", async (c) => {
  const shopId = c.get("session").shopId;
  const userId = c.get("session").sub;
  const parsed = stockInBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です" }, 400);
  const p = await prisma.product.findFirst({ where: { id: parsed.data.productId, shopId } });
  if (!p) return c.json({ error: "商品が見つかりません" }, 404);
  const m = await prisma.stockMovement.create({
    data: {
      shopId,
      type: StockMovementType.IN,
      productId: p.id,
      qty: parsed.data.qty,
      occurredAt: new Date(parsed.data.occurredAt),
      reason: parsed.data.reason ?? "入庫",
      createdByUserId: userId,
    },
  });
  return c.json({ movement: m });
});

const stockOutManual = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1),
});

api.post("/stock/out-manual", async (c) => {
  const shopId = c.get("session").shopId;
  const userId = c.get("session").sub;
  const parsed = stockOutManual.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "理由・数量を確認してください" }, 400);
  const p = await prisma.product.findFirst({ where: { id: parsed.data.productId, shopId } });
  if (!p) return c.json({ error: "商品が見つかりません" }, 404);
  const bal = await stockQtyForProduct(prisma, p.id);
  if (bal < parsed.data.qty) return c.json({ error: "在庫が足りません" }, 400);
  const m = await prisma.stockMovement.create({
    data: {
      shopId,
      type: StockMovementType.OUT_MANUAL,
      productId: p.id,
      qty: parsed.data.qty,
      unitCostSnapshot: p.standardCost,
      occurredAt: new Date(parsed.data.occurredAt),
      reason: parsed.data.reason,
      createdByUserId: userId,
    },
  });
  return c.json({ movement: m });
});

const adjustBody = z.object({
  productId: z.string(),
  qty: z.number().int(),
  occurredAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1),
});

api.post("/stock/adjust", async (c) => {
  const shopId = c.get("session").shopId;
  const userId = c.get("session").sub;
  const parsed = adjustBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "入力が不正です" }, 400);
  const p = await prisma.product.findFirst({ where: { id: parsed.data.productId, shopId } });
  if (!p) return c.json({ error: "商品が見つかりません" }, 404);
  const m = await prisma.stockMovement.create({
    data: {
      shopId,
      type: StockMovementType.ADJUST,
      productId: p.id,
      qty: parsed.data.qty,
      occurredAt: new Date(parsed.data.occurredAt),
      reason: parsed.data.reason,
      createdByUserId: userId,
    },
  });
  return c.json({ movement: m });
});

const saleLineIn = z.discriminatedUnion("lineType", [
  z.object({
    lineType: z.literal("SERVICE"),
    serviceId: z.string(),
    qty: z.number().int().positive(),
    unitPriceTaxIn: z.number().int().min(0),
    unitPriceTaxEx: z.number().int().min(0).optional(),
    taxRate: z.number().int().min(0).max(100),
  }),
  z.object({
    lineType: z.literal("PRODUCT"),
    productId: z.string(),
    qty: z.number().int().positive(),
    unitPriceTaxIn: z.number().int().min(0),
    unitPriceTaxEx: z.number().int().min(0).optional(),
    taxRate: z.number().int().min(0).max(100),
    deductStockNow: z.boolean().optional(),
  }),
]);

const saleCreate = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  customerName: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  lines: z.array(saleLineIn).min(1),
});

api.post("/sales", async (c) => {
  const shopId = c.get("session").shopId;
  const userId = c.get("session").sub;
  const parsed = saleCreate.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "明細を確認してください", details: parsed.error.flatten() }, 400);

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          shopId,
          occurredAt: new Date(parsed.data.occurredAt),
          customerName: parsed.data.customerName ?? null,
          paymentMethod: parsed.data.paymentMethod ?? null,
          memo: parsed.data.memo ?? null,
          createdByUserId: userId,
        },
      });

      let order = 0;
      for (const line of parsed.data.lines) {
        const unitPriceTaxIn =
          line.unitPriceTaxEx != null
            ? taxIncludedFromExcluded(line.unitPriceTaxEx, line.taxRate)
            : line.unitPriceTaxIn;
        const parts = taxPartsFromIncluded(unitPriceTaxIn, line.taxRate);
        const lineTotalExcluded = parts.taxExcluded * line.qty;
        const lineTotalTax = parts.taxAmount * line.qty;
        const lineTotalIncluded = parts.taxIncluded * line.qty;

        const sl = await tx.saleLine.create({
          data: {
            saleId: s.id,
            lineOrder: order++,
            lineType: line.lineType === "SERVICE" ? SaleLineType.SERVICE : SaleLineType.PRODUCT,
            serviceId: line.lineType === "SERVICE" ? line.serviceId : null,
            productId: line.lineType === "PRODUCT" ? line.productId : null,
            qty: line.qty,
            unitPriceTaxIn,
            taxRate: line.taxRate,
            taxExcludedAmount: lineTotalExcluded,
            taxAmount: lineTotalTax,
            taxIncludedAmount: lineTotalIncluded,
          },
        });

        if (line.lineType === "PRODUCT" && line.deductStockNow !== false) {
          const prod = await tx.product.findFirst({ where: { id: line.productId, shopId } });
          if (!prod) throw new Error("PRODUCT_NOT_FOUND");
          const bal = await stockQtyForProduct(tx, prod.id);
          if (bal < line.qty) throw new Error("STOCK_SHORT");
          await tx.stockMovement.create({
            data: {
              shopId,
              type: StockMovementType.OUT_SALE,
              productId: prod.id,
              qty: line.qty,
              unitCostSnapshot: prod.standardCost,
              occurredAt: new Date(parsed.data.occurredAt),
              reason: "販売連動",
              refSaleLineId: sl.id,
              createdByUserId: userId,
            },
          });
        }
      }
      return s;
    });

    const full = await prisma.sale.findFirst({
      where: { id: sale.id, shopId },
      include: { lines: { include: { service: true, product: true } }, createdBy: true },
    });
    return c.json({ sale: full });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "STOCK_SHORT") return c.json({ error: "在庫が足りない商品があります" }, 400);
    if (msg === "PRODUCT_NOT_FOUND") return c.json({ error: "商品が見つかりません" }, 400);
    throw e;
  }
});

api.get("/sales", async (c) => {
  const shopId = c.get("session").shopId;
  const from = c.req.query("from");
  const to = c.req.query("to");
  const where: Prisma.SaleWhereInput = { shopId };
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = new Date(from);
    if (to) where.occurredAt.lte = new Date(to);
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: {
      lines: true,
      createdBy: { select: { name: true } },
    },
  });
  return c.json({ sales });
});

api.get("/sales/:id", async (c) => {
  const shopId = c.get("session").shopId;
  const id = c.req.param("id");
  const sale = await prisma.sale.findFirst({
    where: { id, shopId },
    include: { lines: { include: { service: true, product: true } }, createdBy: { select: { name: true, email: true } } },
  });
  if (!sale) return c.json({ error: "見つかりません" }, 404);
  return c.json({ sale });
});

api.post("/sales/:id/void", async (c) => {
  const shopId = c.get("session").shopId;
  const userId = c.get("session").sub;
  const id = c.req.param("id");
  const sale = await prisma.sale.findFirst({
    where: { id, shopId, voidedAt: null },
    include: { lines: true },
  });
  if (!sale) return c.json({ error: "取消できません" }, 400);

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id }, data: { voidedAt: new Date() } });
    const outs = await tx.stockMovement.findMany({
      where: { refSaleLineId: { in: sale.lines.map((l) => l.id) }, type: StockMovementType.OUT_SALE },
    });
    for (const m of outs) {
      await tx.stockMovement.create({
        data: {
          shopId,
          type: StockMovementType.IN,
          productId: m.productId,
          qty: m.qty,
          occurredAt: new Date(),
          reason: `売上取消: ${sale.id}`,
          createdByUserId: userId,
        },
      });
    }
  });

  return c.json({ ok: true });
});

function monthBoundsUtc(ym: string) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

api.get("/dashboard", async (c) => {
  const shopId = c.get("session").shopId;
  const ym = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
  const bounds = monthBoundsUtc(ym);
  if (!bounds) return c.json({ error: "month=YYYY-MM" }, 400);
  const { start, end } = bounds;

  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

  const salesMonth = await prisma.sale.findMany({
    where: { shopId, voidedAt: null, occurredAt: { gte: start, lte: end } },
    include: { lines: { include: { service: true, product: true } } },
  });

  const salesToday = await prisma.sale.findMany({
    where: { shopId, voidedAt: null, occurredAt: { gte: dayStart, lte: dayEnd } },
    include: { lines: true },
  });

  let totalTaxIn = 0;
  const serviceByCat: Record<string, number> = { MIMILO: 0, ESTE: 0, OTHER: 0 };
  let productRevenueTaxIn = 0;
  let productGrossPaymentBasis = 0;

  for (const s of salesMonth) {
    for (const l of s.lines) {
      totalTaxIn += l.taxIncludedAmount;
      if (l.lineType === "SERVICE" && l.serviceId && l.service) {
        serviceByCat[l.service.category] = (serviceByCat[l.service.category] ?? 0) + l.taxIncludedAmount;
      }
      if (l.lineType === "PRODUCT" && l.productId && l.product) {
        productRevenueTaxIn += l.taxIncludedAmount;
        const cost = l.product.standardCost * l.qty;
        productGrossPaymentBasis += l.taxIncludedAmount - cost;
      }
    }
  }

  let todayTaxIn = 0;
  for (const s of salesToday) {
    for (const l of s.lines) todayTaxIn += l.taxIncludedAmount;
  }

  const movementsMonth = await prisma.stockMovement.findMany({
    where: {
      shopId,
      occurredAt: { gte: start, lte: end },
      type: { in: [StockMovementType.OUT_SALE, StockMovementType.OUT_MANUAL] },
    },
    include: { product: true },
  });

  let outboundCost = 0;
  let outboundReferenceMargin = 0;
  for (const m of movementsMonth) {
    const unitCost = m.unitCostSnapshot ?? m.product.standardCost;
    outboundCost += unitCost * m.qty;
    outboundReferenceMargin += m.product.listPriceTaxIn * m.qty - unitCost * m.qty;
  }

  const productMarginRatePayment =
    productRevenueTaxIn > 0 ? Math.round((productGrossPaymentBasis / productRevenueTaxIn) * 1000) / 10 : 0;

  const alerts = await prisma.product.findMany({ where: { shopId, active: true } });
  const alertRows: { productId: string; name: string; qty: number; minStock: number }[] = [];
  for (const p of alerts) {
    const qty = await stockQtyForProduct(prisma, p.id);
    if (qty <= p.minStock) alertRows.push({ productId: p.id, name: p.name, qty, minStock: p.minStock });
  }

  return c.json({
    month: ym,
    totals: {
      salesTaxIn: totalTaxIn,
      todaySalesTaxIn: todayTaxIn,
      serviceByCategoryTaxIn: serviceByCat,
      productSalesTaxIn: productRevenueTaxIn,
      productGrossProfitPaymentBasis: productGrossPaymentBasis,
      productMarginRatePercent: productMarginRatePayment,
      productOutboundCostTaxInMonth: outboundCost,
      productGrossProfitOutboundReference: outboundReferenceMargin,
    },
    alerts: alertRows.sort((a, b) => a.name.localeCompare(b.name, "ja")),
  });
});

api.get("/reports/monthly", async (c) => {
  const shopId = c.get("session").shopId;
  const ym = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
  const bounds = monthBoundsUtc(ym);
  if (!bounds) return c.json({ error: "month=YYYY-MM" }, 400);
  const sales = await prisma.sale.findMany({
    where: { shopId, voidedAt: null, occurredAt: { gte: bounds.start, lte: bounds.end } },
    include: { lines: { include: { service: true, product: true } } },
  });
  let total = 0;
  let services = 0;
  let products = 0;
  for (const s of sales) {
    for (const l of s.lines) {
      total += l.taxIncludedAmount;
      if (l.lineType === "SERVICE") services += l.taxIncludedAmount;
      else products += l.taxIncludedAmount;
    }
  }
  return c.json({ month: ym, count: sales.length, totalTaxIn: total, serviceTaxIn: services, productTaxIn: products });
});

api.get("/export/csv", async (c) => {
  // 互換のため旧URLは売上CSVへリダイレクト
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "from と to（ISO日時）を指定してください" }, 400);
  return c.redirect(`/api/export/csv/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 302);
});

api.get("/export/csv/sales", async (c) => {
  const shopId = c.get("session").shopId;
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "from と to（ISO日時）を指定してください" }, 400);
  const sales = await prisma.sale.findMany({
    where: {
      shopId,
      occurredAt: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { occurredAt: "asc" },
    include: { lines: { include: { service: true, product: true } } },
  });

  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = [
    "日付",
    "取引ID",
    "取消",
    "顧客名",
    "行番号",
    "種別",
    "カテゴリ",
    "品目名",
    "数量",
    "税率",
    "税抜合計",
    "税額合計",
    "税込合計",
    "仕入原価合計",
    "粗利（入金基準）",
    "支払方法",
    "メモ",
  ];

  const lines: string[] = [header.join(",")];
  for (const s of sales) {
    const voided = s.voidedAt ? "はい" : "いいえ";
    for (const l of s.lines.sort((a, b) => a.lineOrder - b.lineOrder)) {
      const kind = l.lineType === "SERVICE" ? "service" : "product";
      const cat =
        l.lineType === "SERVICE" && l.service
          ? l.service.category
          : l.product?.category ?? "";
      const name =
        l.lineType === "SERVICE" && l.service
          ? l.service.name
          : l.product?.name ?? "";
      const cost = l.lineType === "PRODUCT" && l.product ? l.product.standardCost * l.qty : 0;
      const gross = l.taxIncludedAmount - cost;
      lines.push(
        [
          esc(s.occurredAt.toISOString()),
          esc(s.id),
          esc(voided),
          esc(s.customerName),
          esc(l.lineOrder + 1),
          esc(kind),
          esc(cat),
          esc(name),
          esc(l.qty),
          esc(l.taxRate),
          esc(l.taxExcludedAmount),
          esc(l.taxAmount),
          esc(l.taxIncludedAmount),
          esc(cost),
          esc(gross),
          esc(s.paymentMethod),
          esc(s.memo),
        ].join(",")
      );
    }
  }

  const bom = "\uFEFF";
  const body = bom + lines.join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-lines-${from.slice(0, 10)}_${to.slice(0, 10)}.csv"`,
    },
  });
});

api.get("/export/csv/inventory", async (c) => {
  const shopId = c.get("session").shopId;
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "from と to（ISO日時）を指定してください" }, 400);
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const products = await prisma.product.findMany({
    where: { shopId, active: true },
    orderBy: { name: "asc" },
  });
  const lines: string[] = [];

  lines.push("【在庫評価】");
  lines.push(["商品名", "現在庫数", "仕入単価", "在庫金額"].join(","));
  for (const p of products) {
    const qty = await stockQtyForProduct(prisma, p.id);
    const amount = qty * p.standardCost;
    lines.push([esc(p.name), esc(qty), esc(p.standardCost), esc(amount)].join(","));
  }

  lines.push("");
  lines.push("【期間内 入出庫履歴】");
  lines.push(["日時", "種別", "商品名", "数量", "仕入単価", "原価金額", "理由", "登録者"].join(","));
  const movements = await prisma.stockMovement.findMany({
    where: { shopId, occurredAt: { gte: fromDate, lte: toDate } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: { product: true, createdBy: { select: { name: true } } },
  });
  for (const m of movements) {
    const signedQty = m.type === StockMovementType.IN ? m.qty : -m.qty;
    const unitCost = m.unitCostSnapshot ?? m.product.standardCost;
    const amount = unitCost * signedQty;
    lines.push(
      [
        esc(m.occurredAt.toISOString()),
        esc(m.type),
        esc(m.product.name),
        esc(signedQty),
        esc(unitCost),
        esc(amount),
        esc(m.reason),
        esc(m.createdBy.name),
      ].join(",")
    );
  }

  lines.push("");
  lines.push("【期間内 出庫ベース粗利（商品ごと合計）】");
  lines.push(["商品名", "出庫数量", "出庫売上見込（税込）", "出庫原価", "粗利"].join(","));
  const outbounds = await prisma.stockMovement.findMany({
    where: {
      shopId,
      occurredAt: { gte: fromDate, lte: toDate },
      type: { in: [StockMovementType.OUT_SALE, StockMovementType.OUT_MANUAL] },
    },
    include: { product: true },
  });
  const summary = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
  for (const m of outbounds) {
    const key = m.productId;
    const row = summary.get(key) ?? { name: m.product.name, qty: 0, revenue: 0, cost: 0 };
    const unitCost = m.unitCostSnapshot ?? m.product.standardCost;
    row.qty += m.qty;
    row.revenue += m.product.listPriceTaxIn * m.qty;
    row.cost += unitCost * m.qty;
    summary.set(key, row);
  }
  const sorted = [...summary.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  for (const row of sorted) {
    lines.push([esc(row.name), esc(row.qty), esc(row.revenue), esc(row.cost), esc(row.revenue - row.cost)].join(","));
  }

  const bom = "\uFEFF";
  const body = bom + lines.join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${from.slice(0, 10)}_${to.slice(0, 10)}.csv"`,
    },
  });
});

app.route("/api", api);

app.get("/health", (c) => c.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
  // 本番は同一オリジン配信: API と画面を同じサーバーから返す
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api")) return c.notFound();
    const html = await readFile(resolve(process.cwd(), "dist", "index.html"), "utf-8");
    return c.html(html);
  });
}

export { app };
