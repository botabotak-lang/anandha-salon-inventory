import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Line = { taxIncludedAmount: number };
type Sale = {
  id: string;
  occurredAt: string;
  customerName: string | null;
  voidedAt: string | null;
  lines: Line[];
  createdBy: { name: string };
};

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api<{ sales: Sale[] }>("/api/sales");
        setSales(d.sales);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "失敗");
      }
    })();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>売上一覧</h1>
      <p>
        <Link to="/sales/new">＋ 新規売上</Link>
      </p>
      {err && <div className="alert error">{err}</div>}
      {sales.map((s) => {
        const total = s.lines.reduce((a, l) => a + l.taxIncludedAmount, 0);
        return (
          <div key={s.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <Link to={`/sales/${s.id}`}>
                <strong>{new Date(s.occurredAt).toLocaleString("ja-JP")}</strong>
              </Link>
              {s.voidedAt && <span style={{ color: "#b00020" }}>取消済</span>}
            </div>
            <div style={{ fontSize: "0.95rem", color: "#444" }}>
              顧客: {s.customerName || "—"} / 計 {total.toLocaleString()}円（税込） / 入力: {s.createdBy.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
