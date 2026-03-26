import { useEffect, useState } from "react";
import { api } from "../api";

type Dash = {
  month: string;
  totals: {
    salesTaxIn: number;
    todaySalesTaxIn: number;
    serviceByCategoryTaxIn: Record<string, number>;
    productSalesTaxIn: number;
    productGrossProfitPaymentBasis: number;
    productMarginRatePercent: number;
    productOutboundCostTaxInMonth: number;
    productGrossProfitOutboundReference: number;
  };
  alerts: { productId: string; name: string; qty: number; minStock: number }[];
};

const catLabel: Record<string, string> = {
  MIMILO: "耳つぼ",
  ESTE: "エステ",
  OTHER: "その他",
};

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function DashboardPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api<Dash>(`/api/dashboard?month=${encodeURIComponent(month)}`);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>ダッシュボード</h1>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="m">対象月</label>
        <input id="m" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {err && <div className="alert error">{err}</div>}
      {!data && !err && <p>読み込み中…</p>}
      {data && (
        <>
          {data.alerts.length > 0 && (
            <div className="alert">
              <strong>在庫アラート</strong>
              <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem" }}>
                {data.alerts.map((a) => (
                  <li key={a.productId}>
                    {a.name} … 残{a.qty}（最小{a.minStock}）
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card stack">
            <div>
              <strong>今日の売上（税込）</strong>
              <div style={{ fontSize: "1.25rem" }}>{yen(data.totals.todaySalesTaxIn)}</div>
            </div>
            <div>
              <strong>今月の売上合計（税込・取消除く）</strong>
              <div style={{ fontSize: "1.25rem" }}>{yen(data.totals.salesTaxIn)}</div>
            </div>
          </div>
          <div className="card">
            <strong>施術売上（税込・カテゴリ別）</strong>
            <table>
              <tbody>
                {Object.entries(data.totals.serviceByCategoryTaxIn).map(([k, v]) => (
                  <tr key={k}>
                    <td>{catLabel[k] ?? k}</td>
                    <td>{yen(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card stack">
            <strong>物販（税込）</strong>
            <div>売上（入金ベース）: {yen(data.totals.productSalesTaxIn)}</div>
            <div>粗利（入金ベース・税込売上−標準原価×数量）: {yen(data.totals.productGrossProfitPaymentBasis)}</div>
            <div>粗利率（参考）: {data.totals.productMarginRatePercent}%</div>
            <hr style={{ border: "none", borderTop: "1px solid #eee" }} />
            <div>出庫原価合計（当月・OUT参照）: {yen(data.totals.productOutboundCostTaxInMonth)}</div>
            <div>
              出庫ベース参考粗利（税込売価×数量−原価×数量）: {yen(data.totals.productGrossProfitOutboundReference)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
