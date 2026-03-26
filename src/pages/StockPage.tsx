import { useEffect, useState } from "react";
import { api } from "../api";

type Row = {
  product: { id: string; name: string; minStock: number };
  qty: number;
  alert: boolean;
};

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StockPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [pidIn, setPidIn] = useState("");
  const [qtyIn, setQtyIn] = useState(1);
  const [whenIn, setWhenIn] = useState(isoLocal(new Date()));

  const [pidOut, setPidOut] = useState("");
  const [qtyOut, setQtyOut] = useState(1);
  const [reasonOut, setReasonOut] = useState("コース付帯の手渡し");
  const [whenOut, setWhenOut] = useState(isoLocal(new Date()));

  async function load() {
    const s = await api<{ rows: Row[] }>("/api/stock/summary");
    setRows(s.rows);
    const p = await api<{ products: { id: string; name: string }[] }>("/api/products");
    setProducts(p.products.filter((x) => x));
    if (!pidIn && p.products[0]) setPidIn(p.products[0].id);
    if (!pidOut && p.products[0]) setPidOut(p.products[0].id);
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "失敗"));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>在庫</h1>
      <p style={{ fontSize: "0.95rem", color: "#444", marginTop: "-0.25rem" }}>
        <strong>新しい商品の名前や価格</strong>を登録するときは、下のメニュー「<strong>物販マスタ</strong>」の「新規追加」から手入力してください。ここでは
        <strong>入庫・出庫（数量）</strong>だけを記録します。
      </p>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <div className="card stack">
        <strong>入庫</strong>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            await api("/api/stock/in", {
              method: "POST",
              body: JSON.stringify({
                productId: pidIn,
                qty: qtyIn,
                occurredAt: new Date(whenIn).toISOString(),
                reason: "入庫",
              }),
            });
            setMsg("入庫を記録しました");
            await load();
          }}
        >
          <div>
            <label>商品</label>
            <select value={pidIn} onChange={(e) => setPidIn(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>数量</label>
            <input type="number" inputMode="numeric" min={1} value={qtyIn} onChange={(e) => setQtyIn(Number(e.target.value))} />
          </div>
          <div>
            <label>日時</label>
            <input type="datetime-local" value={whenIn} onChange={(e) => setWhenIn(e.target.value)} />
          </div>
          <button type="submit" className="primary">
            入庫する
          </button>
        </form>
      </div>
      <div className="card stack">
        <strong>手動出庫（理由必須）</strong>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            await api("/api/stock/out-manual", {
              method: "POST",
              body: JSON.stringify({
                productId: pidOut,
                qty: qtyOut,
                occurredAt: new Date(whenOut).toISOString(),
                reason: reasonOut,
              }),
            });
            setMsg("出庫を記録しました");
            await load();
          }}
        >
          <div>
            <label>商品</label>
            <select value={pidOut} onChange={(e) => setPidOut(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>数量</label>
            <input type="number" inputMode="numeric" min={1} value={qtyOut} onChange={(e) => setQtyOut(Number(e.target.value))} />
          </div>
          <div>
            <label>理由</label>
            <input value={reasonOut} onChange={(e) => setReasonOut(e.target.value)} required />
          </div>
          <div>
            <label>日時</label>
            <input type="datetime-local" value={whenOut} onChange={(e) => setWhenOut(e.target.value)} />
          </div>
          <button type="submit" className="primary">
            出庫する
          </button>
        </form>
      </div>
      <h2 style={{ fontSize: "1.15rem" }}>在庫一覧</h2>
      <p style={{ fontSize: "0.9rem", color: "#555" }}>
        列「最小在庫」＝「この個数以下になったらダッシュボードで知らせる目安」です。発注ラインを決めて数字を入れてください（0ならアラートは出ません）。
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>残数</th>
              <th>最小在庫（目安）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.id} style={r.alert ? { background: "#fff8e1" } : undefined}>
                <td>{r.product.name}</td>
                <td>{r.qty}</td>
                <td>{r.product.minStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
