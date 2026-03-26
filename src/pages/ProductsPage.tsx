import { useEffect, useState } from "react";
import { api } from "../api";

type Product = {
  id: string;
  name: string;
  category: string | null;
  defaultTaxRate: number;
  listPriceTaxIn: number;
  standardCost: number;
  minStock: number;
  active: boolean;
};

export function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);

  async function load() {
    const d = await api<{ products: Product[] }>("/api/products");
    setRows(d.products);
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "失敗"));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>物販マスタ</h1>
      {err && <div className="alert error">{err}</div>}
      <div className="card stack">
        <strong>新規追加</strong>
        <ProductForm
          initial={null}
          onSave={async (p) => {
            await api("/api/products", { method: "POST", body: JSON.stringify(p) });
            await load();
          }}
        />
      </div>
      {rows.map((p) => (
        <div key={p.id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{p.name}</strong>
            <button type="button" onClick={() => setEditing(p)}>
              編集
            </button>
          </div>
          <div style={{ fontSize: "0.95rem", color: "#444" }}>
            税込売価 {p.listPriceTaxIn.toLocaleString()}円 / 税率 {p.defaultTaxRate}% / 原価 {p.standardCost.toLocaleString()}円 / 最小在庫{" "}
            {p.minStock}
            {!p.active && "（無効）"}
          </div>
          {editing?.id === p.id && (
            <ProductForm
              initial={p}
              onSave={async (body) => {
                await api(`/api/products/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
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

function ProductForm({
  initial,
  onSave,
}: {
  initial: Product | null;
  onSave: (p: {
    name: string;
    category?: string | null;
    defaultTaxRate: number;
    listPriceTaxIn: number;
    standardCost: number;
    minStock: number;
    active?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [defaultTaxRate, setDefaultTaxRate] = useState(initial?.defaultTaxRate ?? 8);
  const [listPriceTaxIn, setListPriceTaxIn] = useState(initial?.listPriceTaxIn ?? 0);
  const [standardCost, setStandardCost] = useState(initial?.standardCost ?? 0);
  const [minStock, setMinStock] = useState(initial?.minStock ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          name,
          category: category || null,
          defaultTaxRate: Number(defaultTaxRate),
          listPriceTaxIn: Number(listPriceTaxIn),
          standardCost: Number(standardCost),
          minStock: Number(minStock),
          active,
        });
        if (!initial) {
          setName("");
          setCategory("");
          setListPriceTaxIn(0);
          setStandardCost(0);
          setMinStock(0);
        }
      }}
    >
      <div>
        <label>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>カテゴリ（任意）</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="row">
        <div style={{ flex: "1 1 120px" }}>
          <label>税率%</label>
          <input
            type="number"
            inputMode="numeric"
            value={defaultTaxRate}
            onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label>税込売価（円）</label>
          <input
            type="number"
            inputMode="numeric"
            value={listPriceTaxIn}
            onChange={(e) => setListPriceTaxIn(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: "1 1 140px" }}>
          <label>標準原価（円）</label>
          <input
            type="number"
            inputMode="numeric"
            value={standardCost}
            onChange={(e) => setStandardCost(Number(e.target.value))}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label>最小在庫</label>
          <input
            type="number"
            inputMode="numeric"
            value={minStock}
            onChange={(e) => setMinStock(Number(e.target.value))}
          />
        </div>
      </div>
      {initial && (
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          有効
        </label>
      )}
      <button type="submit" className="primary">
        {initial ? "更新" : "追加"}
      </button>
    </form>
  );
}
