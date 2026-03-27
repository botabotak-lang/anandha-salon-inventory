import { useEffect, useState } from "react";
import { api } from "../api";
import { taxIncludedFromExcluded, taxPartsFromIncluded } from "../../shared/tax";

type Service = {
  id: string;
  name: string;
  category: "MIMILO" | "ESTE" | "OTHER";
  taxRate: number;
  unitPriceTaxIn: number;
  standardCost: number;
  active: boolean;
};

const cats: { v: Service["category"]; l: string }[] = [
  { v: "MIMILO", l: "耳つぼ" },
  { v: "ESTE", l: "エステ" },
  { v: "OTHER", l: "その他" },
];

export function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);

  async function load() {
    const d = await api<{ services: Service[] }>("/api/services");
    setRows(d.services);
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "失敗"));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>施術マスタ</h1>
      {err && <div className="alert error">{err}</div>}
      <div className="card stack">
        <strong>新規追加</strong>
        <ServiceForm
          initial={null}
          onSave={async (p) => {
            await api("/api/services", { method: "POST", body: JSON.stringify(p) });
            await load();
          }}
        />
      </div>
      {rows.map((s) => (
        <div key={s.id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{s.name}</strong>
            <button type="button" onClick={() => setEditing(s)}>
              編集
            </button>
          </div>
          <div style={{ fontSize: "0.95rem", color: "#444" }}>
            {cats.find((c) => c.v === s.category)?.l ?? s.category} / 税込 {s.unitPriceTaxIn.toLocaleString()}円（税抜
            {taxPartsFromIncluded(s.unitPriceTaxIn, s.taxRate).taxExcluded.toLocaleString()}円） / 税率{" "}
            {s.taxRate}%
            {!s.active && "（無効）"}
          </div>
          {editing?.id === s.id && (
            <ServiceForm
              initial={s}
              onSave={async (body) => {
                await api(`/api/services/${s.id}`, { method: "PATCH", body: JSON.stringify(body) });
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

function ServiceForm({
  initial,
  onSave,
}: {
  initial: Service | null;
  onSave: (p: {
    name: string;
    category: Service["category"];
    taxRate: number;
    unitPriceTaxEx: number;
    standardCost?: number;
    active?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Service["category"]>(initial?.category ?? "MIMILO");
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 10);
  const [unitPriceTaxEx, setUnitPriceTaxEx] = useState(
    initial ? taxPartsFromIncluded(initial.unitPriceTaxIn, initial.taxRate).taxExcluded : 0
  );
  const [standardCost, setStandardCost] = useState(initial?.standardCost ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const autoTaxIn = taxIncludedFromExcluded(Number(unitPriceTaxEx), Number(taxRate));

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          name,
          category,
          taxRate: Number(taxRate),
          unitPriceTaxEx: Number(unitPriceTaxEx),
          standardCost: Number(standardCost),
          active,
        });
        if (!initial) {
          setName("");
          setUnitPriceTaxEx(0);
        }
      }}
    >
      <div>
        <label>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>カテゴリ</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as Service["category"])}>
          {cats.map((c) => (
            <option key={c.v} value={c.v}>
              {c.l}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div style={{ flex: "1 1 120px" }}>
          <label>税率%</label>
          <input type="number" inputMode="numeric" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label>単価（税抜・円）</label>
          <input
            type="number"
            inputMode="numeric"
            value={unitPriceTaxEx}
            onChange={(e) => setUnitPriceTaxEx(Number(e.target.value))}
          />
        </div>
      </div>
      <div style={{ fontSize: "0.95rem", color: "#444" }}>税込（自動）: {autoTaxIn.toLocaleString()}円</div>
      <div>
        <label>原価（円・既定0）</label>
        <input
          type="number"
          inputMode="numeric"
          value={standardCost}
          onChange={(e) => setStandardCost(Number(e.target.value))}
        />
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
