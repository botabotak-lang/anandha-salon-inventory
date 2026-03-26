import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type Svc = { id: string; name: string; unitPriceTaxIn: number; taxRate: number };
type Prd = { id: string; name: string; listPriceTaxIn: number; defaultTaxRate: number };

type Line =
  | { lineType: "SERVICE"; serviceId: string; qty: number; unitPriceTaxIn: number; taxRate: number }
  | { lineType: "PRODUCT"; productId: string; qty: number; unitPriceTaxIn: number; taxRate: number };

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SaleNewPage() {
  const nav = useNavigate();
  const [services, setServices] = useState<Svc[]>([]);
  const [products, setProducts] = useState<Prd[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [memo, setMemo] = useState("");
  const [when, setWhen] = useState(isoLocal(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [sv, pr] = await Promise.all([
        api<{ services: Svc[] }>("/api/services"),
        api<{ products: Prd[] }>("/api/products"),
      ]);
      setServices(sv.services.filter((s) => (s as { active?: boolean }).active !== false));
      setProducts(pr.products.filter((p) => (p as { active?: boolean }).active !== false));
    })().catch(() => setErr("マスタの取得に失敗しました"));
  }, []);

  function addService() {
    const s = services[0];
    if (!s) return;
    setLines((ls) => [
      ...ls,
      { lineType: "SERVICE", serviceId: s.id, qty: 1, unitPriceTaxIn: s.unitPriceTaxIn, taxRate: s.taxRate },
    ]);
  }

  function addProduct() {
    const p = products[0];
    if (!p) return;
    setLines((ls) => [
      ...ls,
      {
        lineType: "PRODUCT",
        productId: p.id,
        qty: 1,
        unitPriceTaxIn: p.listPriceTaxIn,
        taxRate: p.defaultTaxRate,
      },
    ]);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>売上入力</h1>
      {err && <div className="alert error">{err}</div>}
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (lines.length === 0) {
            setErr("明細を1行以上追加してください");
            return;
          }
          try {
            const res = await api<{ sale: { id: string } }>("/api/sales", {
              method: "POST",
              body: JSON.stringify({
                occurredAt: new Date(when).toISOString(),
                customerName: customerName || null,
                paymentMethod: paymentMethod || null,
                memo: memo || null,
                lines,
              }),
            });
            nav(`/sales/${res.sale.id}`);
          } catch (er) {
            setErr(er instanceof Error ? er.message : "登録失敗");
          }
        }}
      >
        <div>
          <label>日時</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div>
          <label>お客様名</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="任意（推奨）" />
        </div>
        <div>
          <label>支払方法</label>
          <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="現金／カード など" />
        </div>
        <div>
          <label>メモ（延長など）</label>
          <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div className="row">
          <button type="button" onClick={addService}>
            ＋ 施術行
          </button>
          <button type="button" onClick={addProduct}>
            ＋ 物販行
          </button>
        </div>
        {lines.map((ln, i) => (
          <div key={i} className="card stack" style={{ background: "#fafafa" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{ln.lineType === "SERVICE" ? "施術" : "物販"}</strong>
              <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                削除
              </button>
            </div>
            {ln.lineType === "SERVICE" ? (
              <>
                <label>施術</label>
                <select
                  value={ln.serviceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const s = services.find((x) => x.id === id);
                    setLines((ls) =>
                      ls.map((x, j) =>
                        j === i && x.lineType === "SERVICE"
                          ? {
                              ...x,
                              serviceId: id,
                              unitPriceTaxIn: s?.unitPriceTaxIn ?? x.unitPriceTaxIn,
                              taxRate: s?.taxRate ?? x.taxRate,
                            }
                          : x
                      )
                    );
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label>商品</label>
                <select
                  value={ln.productId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = products.find((x) => x.id === id);
                    setLines((ls) =>
                      ls.map((x, j) =>
                        j === i && x.lineType === "PRODUCT"
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
              </>
            )}
            <div className="row">
              <div style={{ flex: "1 1 100px" }}>
                <label>数量</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={ln.qty}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x))
                    )
                  }
                />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label>税込単価</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={ln.unitPriceTaxIn}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, unitPriceTaxIn: Number(e.target.value) } : x))
                    )
                  }
                />
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <label>税率%</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={ln.taxRate}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, taxRate: Number(e.target.value) } : x))
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
        <button type="submit" className="primary">
          登録する
        </button>
      </form>
    </div>
  );
}
