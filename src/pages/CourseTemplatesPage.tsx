import { useEffect, useState } from "react";
import { api } from "../api";

type Product = {
  id: string;
  name: string;
  listPriceTaxIn: number;
  defaultTaxRate: number;
  active: boolean;
};

type CourseItem = {
  id?: string;
  productId: string;
  qty: number;
  unitPriceTaxIn: number;
  taxRate: number;
  product?: { name: string };
};

type CourseTemplate = {
  id: string;
  name: string;
  months: number;
  active: boolean;
  items: CourseItem[];
};

export function CourseTemplatesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [editing, setEditing] = useState<CourseTemplate | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [pr, tp] = await Promise.all([
      api<{ products: Product[] }>("/api/products"),
      api<{ templates: CourseTemplate[] }>("/api/course-templates"),
    ]);
    setProducts(pr.products.filter((p) => p.active));
    setTemplates(tp.templates);
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "読込に失敗しました"));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>コースマスタ</h1>
      <p style={{ color: "#444", fontSize: "0.95rem" }}>
        1ヶ月/2ヶ月/3ヶ月など、コース選択時に自動展開する「商品・数量・単価」を設定します。
      </p>
      {err && <div className="alert error">{err}</div>}

      <div className="card stack">
        <strong>新規追加</strong>
        <CourseTemplateForm
          products={products}
          initial={null}
          onSave={async (body) => {
            await api("/api/course-templates", { method: "POST", body: JSON.stringify(body) });
            await load();
          }}
        />
      </div>

      {templates.map((t) => (
        <div key={t.id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {t.name}（{t.months}ヶ月）
            </strong>
            <button type="button" onClick={() => setEditing(t)}>
              編集
            </button>
          </div>
          <div style={{ fontSize: "0.95rem", color: "#444" }}>
            {t.items.map((it) => `${it.product?.name ?? ""} ×${it.qty}`).join(" / ")}
            {!t.active && "（無効）"}
          </div>
          {editing?.id === t.id && (
            <CourseTemplateForm
              products={products}
              initial={t}
              onSave={async (body) => {
                await api(`/api/course-templates/${t.id}`, { method: "PATCH", body: JSON.stringify(body) });
                setEditing(null);
                await load();
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CourseTemplateForm({
  products,
  initial,
  onSave,
}: {
  products: Product[];
  initial: CourseTemplate | null;
  onSave: (body: { name: string; months: number; active?: boolean; items: CourseItem[] }) => Promise<void>;
}) {
  const defaultProduct = products[0];
  const [name, setName] = useState(initial?.name ?? "");
  const [months, setMonths] = useState(initial?.months ?? 1);
  const [active, setActive] = useState(initial?.active ?? true);
  const [items, setItems] = useState<CourseItem[]>(
    initial?.items.length
      ? initial.items.map((x) => ({
          productId: x.productId,
          qty: x.qty,
          unitPriceTaxIn: x.unitPriceTaxIn,
          taxRate: x.taxRate,
        }))
      : defaultProduct
      ? [
          {
            productId: defaultProduct.id,
            qty: 1,
            unitPriceTaxIn: defaultProduct.listPriceTaxIn,
            taxRate: defaultProduct.defaultTaxRate,
          },
        ]
      : []
  );

  function addItem() {
    if (!defaultProduct) return;
    setItems((rows) => [
      ...rows,
      {
        productId: defaultProduct.id,
        qty: 1,
        unitPriceTaxIn: defaultProduct.listPriceTaxIn,
        taxRate: defaultProduct.defaultTaxRate,
      },
    ]);
  }

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          name,
          months: Number(months),
          active,
          items: items.map((x) => ({
            productId: x.productId,
            qty: Number(x.qty),
            unitPriceTaxIn: Number(x.unitPriceTaxIn),
            taxRate: Number(x.taxRate),
          })),
        });
        if (!initial) {
          setName("");
          setMonths(1);
          setItems(
            defaultProduct
              ? [
                  {
                    productId: defaultProduct.id,
                    qty: 1,
                    unitPriceTaxIn: defaultProduct.listPriceTaxIn,
                    taxRate: defaultProduct.defaultTaxRate,
                  },
                ]
              : []
          );
        }
      }}
    >
      <div>
        <label>コース名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>期間（月）</label>
        <input type="number" inputMode="numeric" min={1} max={12} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="card stack" style={{ background: "#fafafa" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{idx + 1}行目</strong>
            <button type="button" onClick={() => setItems((rows) => rows.filter((_, i) => i !== idx))}>
              削除
            </button>
          </div>
          <label>商品</label>
          <select
            value={it.productId}
            onChange={(e) => {
              const id = e.target.value;
              const p = products.find((x) => x.id === id);
              setItems((rows) =>
                rows.map((x, i) =>
                  i === idx
                    ? {
                        ...x,
                        productId: id,
                        unitPriceTaxIn: p?.listPriceTaxIn ?? x.unitPriceTaxIn,
                        taxRate: p?.defaultTaxRate ?? x.taxRate,
                      }
                    : x
                )
              );
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="row">
            <div style={{ flex: "1 1 100px" }}>
              <label>数量</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={it.qty}
                onChange={(e) =>
                  setItems((rows) => rows.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))
                }
              />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label>税込単価</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={it.unitPriceTaxIn}
                onChange={(e) =>
                  setItems((rows) => rows.map((x, i) => (i === idx ? { ...x, unitPriceTaxIn: Number(e.target.value) } : x)))
                }
              />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <label>税率%</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={it.taxRate}
                onChange={(e) =>
                  setItems((rows) => rows.map((x, i) => (i === idx ? { ...x, taxRate: Number(e.target.value) } : x)))
                }
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem}>
        ＋ 商品行を追加
      </button>
      {initial && (
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          有効
        </label>
      )}
      <button type="submit" className="primary" disabled={items.length === 0}>
        {initial ? "更新" : "追加"}
      </button>
    </form>
  );
}
