import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

type Sale = {
  id: string;
  occurredAt: string;
  customerName: string | null;
  paymentMethod: string | null;
  memo: string | null;
  voidedAt: string | null;
  createdBy: { name: string; email: string };
  lines: Array<{
    lineOrder: number;
    lineType: string;
    qty: number;
    unitPriceTaxIn: number;
    taxRate: number;
    taxExcludedAmount: number;
    taxAmount: number;
    taxIncludedAmount: number;
    service: { name: string; category: string } | null;
    product: { name: string } | null;
  }>;
};

const catLabel: Record<string, string> = {
  MIMILO: "耳つぼ",
  ESTE: "エステ",
  OTHER: "その他",
};

export function SaleDetailPage() {
  const { id } = useParams();
  const [sale, setSale] = useState<Sale | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = await api<{ sale: Sale }>(`/api/sales/${id}`);
        setSale(d.sale);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "取得失敗");
      }
    })();
  }, [id]);

  if (err) return <div className="alert error">{err}</div>;
  if (!sale) return <p>読み込み中…</p>;

  const total = sale.lines.reduce((a, l) => a + l.taxIncludedAmount, 0);

  return (
    <div>
      <p>
        <Link to="/sales">← 一覧</Link>
      </p>
      <h1 style={{ fontSize: "1.35rem" }}>取引詳細</h1>
      {sale.voidedAt && <div className="alert error">この取引は取消済みです</div>}
      <div className="card stack">
        <div>日時: {new Date(sale.occurredAt).toLocaleString("ja-JP")}</div>
        <div>顧客名: {sale.customerName || "—"}</div>
        <div>支払: {sale.paymentMethod || "—"}</div>
        <div>メモ: {sale.memo || "—"}</div>
        <div>入力者: {sale.createdBy.name}</div>
        <div>
          <strong>税込合計: {total.toLocaleString()}円</strong>
        </div>
      </div>
      <h2 style={{ fontSize: "1.1rem" }}>明細</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>種別</th>
              <th>品目</th>
              <th>数量</th>
              <th>税込単価</th>
              <th>税込計</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines
              .slice()
              .sort((a, b) => a.lineOrder - b.lineOrder)
              .map((l) => (
                <tr key={l.lineOrder}>
                  <td>{l.lineType === "SERVICE" ? "施術" : "物販"}</td>
                  <td>
                    {l.service
                      ? `${l.service.name}（${catLabel[l.service.category] ?? l.service.category}）`
                      : l.product?.name ?? "—"}
                  </td>
                  <td>{l.qty}</td>
                  <td>{l.unitPriceTaxIn.toLocaleString()}</td>
                  <td>{l.taxIncludedAmount.toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!sale.voidedAt && (
        <button
          type="button"
          className="danger"
          style={{ marginTop: "1rem" }}
          onClick={async () => {
            if (!confirm("この取引を取り消しますか？（在庫は戻します）")) return;
            await api(`/api/sales/${sale.id}/void`, { method: "POST", body: JSON.stringify({}) });
            const d = await api<{ sale: Sale }>(`/api/sales/${sale.id}`);
            setSale(d.sale);
          }}
        >
          取引を取消
        </button>
      )}
    </div>
  );
}
