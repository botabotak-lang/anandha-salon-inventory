import { useEffect, useState } from "react";
import { api } from "../api";

export function MonthlyPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<{
    month: string;
    count: number;
    totalTaxIn: number;
    serviceTaxIn: number;
    productTaxIn: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api<typeof data>(`/api/reports/monthly?month=${encodeURIComponent(month)}`);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "失敗");
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>月次サマリー</h1>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="m">月</label>
        <input id="m" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {err && <div className="alert error">{err}</div>}
      {data && (
        <div className="card stack">
          <div>取引件数（取消除く）: {data.count}</div>
          <div>売上合計（税込）: {data.totalTaxIn.toLocaleString()}円</div>
          <div>うち施術（税込）: {data.serviceTaxIn.toLocaleString()}円</div>
          <div>うち物販（税込）: {data.productTaxIn.toLocaleString()}円</div>
        </div>
      )}
    </div>
  );
}
