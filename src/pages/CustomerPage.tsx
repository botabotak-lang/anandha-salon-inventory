import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newExtraRowId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

type SummaryProduct = {
  productId: string;
  name: string;
  plannedQty: number;
  handedQty: number;
  remainingQty: number;
};

type SummarySale = {
  id: string;
  occurredAt: string;
  voided: boolean;
  memo: string | null;
  totalTaxIn: number;
};

type HandoutRow = {
  id: string;
  occurredAt: string;
  productId: string;
  productName: string;
  qty: number;
  source: string;
  reason: string | null;
  registeredBy: string;
};

type SummaryResponse = {
  customerId: string | null;
  customerName: string;
  sales: SummarySale[];
  products: SummaryProduct[];
  handoutHistory: HandoutRow[];
};

type ExtraLine = { id: string; productId: string; qty: string };

export function CustomerPage() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>();
  const customerId = customerIdParam ?? "";

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [activeProducts, setActiveProducts] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [handThisByProduct, setHandThisByProduct] = useState<Record<string, string>>({});
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
  const [handWhen, setHandWhen] = useState(isoLocal(new Date()));

  const summaryInitKey = useMemo(() => {
    if (!summary) return "";
    return `${summary.customerId ?? ""}:${summary.customerName}:${summary.products.map((p) => p.productId).join(",")}`;
  }, [summary]);

  const loadSummary = useCallback(async (cid: string) => {
    const q = new URLSearchParams({ customerId: cid });
    const res = await api<SummaryResponse>(`/api/customers/summary?${q.toString()}`);
    setSummary(res);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ products: { id: string; name: string; active?: boolean }[] }>("/api/products");
        const list = res.products.filter((p) => (p as { active?: boolean }).active !== false);
        setActiveProducts(list);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!customerId.trim()) {
      setSummary(null);
      setErr(null);
      return;
    }
    setErr(null);
    loadSummary(customerId.trim())
      .then(() => setErr(null))
      .catch((e) => {
        setSummary(null);
        setErr(e instanceof Error ? e.message : "カルテの取得に失敗しました");
      });
  }, [customerId, loadSummary]);

  useEffect(() => {
    if (!summary) {
      setHandThisByProduct({});
      setExtraLines([]);
      return;
    }
    setHandThisByProduct(Object.fromEntries(summary.products.map((p) => [p.productId, ""])));
    setExtraLines([]);
  }, [summaryInitKey]);

  function parseQty(s: string): number {
    const n = Number.parseInt(String(s).trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function submitHandout(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId.trim() || !summary) return;
    setMsg(null);
    setErr(null);

    const items: { productId: string; qty: number }[] = [];
    for (const p of summary.products) {
      const q = parseQty(handThisByProduct[p.productId] ?? "");
      if (q > 0) items.push({ productId: p.productId, qty: q });
    }
    for (const row of extraLines) {
      const q = parseQty(row.qty);
      if (q > 0 && row.productId) items.push({ productId: row.productId, qty: q });
    }

    if (items.length === 0) {
      setErr("1つ以上、今回渡す数量を入力してください");
      return;
    }

    try {
      const res = await api<{ count: number }>("/api/customers/handout", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId.trim(),
          items,
          occurredAt: new Date(handWhen).toISOString(),
        }),
      });
      setMsg(`お渡しを${res.count}件記録し、在庫を減らしました`);
      await loadSummary(customerId.trim());
      setHandWhen(isoLocal(new Date()));
    } catch (er) {
      setErr(er instanceof Error ? er.message : "記録に失敗しました");
    }
  }

  function pct(handed: number, planned: number) {
    if (planned <= 0) return handed > 0 ? 100 : 0;
    return Math.min(100, Math.round((handed / planned) * 100));
  }

  function addExtraLine() {
    const first = activeProducts[0]?.id ?? "";
    setExtraLines((ls) => [...ls, { id: newExtraRowId(), productId: first, qty: "" }]);
  }

  function defaultProductIdForExtra() {
    return activeProducts[0]?.id ?? "";
  }

  if (!customerId.trim()) {
    return (
      <div>
        <h1 style={{ fontSize: "1.35rem" }}>お客様カルテ</h1>
        <p className="alert">お客様が指定されていません。</p>
        <Link to="/customers">お客様マスタへ</Link>
      </div>
    );
  }

  return (
    <div>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link to="/customers">お客様マスタへ戻る</Link>
      </p>
      <h1 style={{ fontSize: "1.35rem" }}>お客様カルテ</h1>
      <p style={{ fontSize: "0.95rem", color: "#444", marginTop: "-0.25rem" }}>
        マスタ登録済みのお客様の<strong>予定数量</strong>と<strong>お渡し記録</strong>です。複数商品を一度に記録して<strong>在庫をまとめて減らせます</strong>。
      </p>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      {summary && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginTop: "1.25rem" }}>{summary.customerName} さん</h2>

          <form className="card stack" style={{ marginTop: "0.75rem" }} onSubmit={submitHandout}>
            <strong>お渡しを記録する（まとめて在庫を減らす）</strong>
            <p style={{ fontSize: "0.88rem", color: "#555", margin: 0 }}>
              表の「今回渡す」に数量を入れた行だけが記録されます。複数商品を同じ日時で一括登録できます（在庫不足があると<strong>どれも記録されません</strong>）。
            </p>

            {summary.products.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>商品</th>
                      <th>予定</th>
                      <th>渡した</th>
                      <th>残り</th>
                      <th>今回渡す</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.products.map((p) => {
                      const bar = pct(p.handedQty, p.plannedQty);
                      const over = p.remainingQty < 0;
                      return (
                        <tr key={p.productId}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div
                              style={{
                                marginTop: "0.25rem",
                                height: "6px",
                                maxWidth: "140px",
                                background: "#eee",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${bar}%`,
                                  height: "100%",
                                  background: over ? "#c62828" : "#2e7d32",
                                }}
                              />
                            </div>
                          </td>
                          <td>{p.plannedQty}</td>
                          <td>{p.handedQty}</td>
                          <td style={over ? { color: "#c62828", fontWeight: 600 } : undefined}>
                            {p.remainingQty}
                            {over && <span style={{ fontSize: "0.75rem", display: "block" }}>超過</span>}
                          </td>
                          <td>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              placeholder="0"
                              value={handThisByProduct[p.productId] ?? ""}
                              onChange={(e) =>
                                setHandThisByProduct((prev) => ({
                                  ...prev,
                                  [p.productId]: e.target.value,
                                }))
                              }
                              style={{ width: "4.5rem" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: "0.9rem", color: "#666" }}>このお客様の物販明細はまだありません。下の「表にない商品」からお渡しを記録できます。</p>
            )}

            {extraLines.length > 0 && (
              <div className="stack" style={{ marginTop: "0.5rem" }}>
                <strong style={{ fontSize: "0.95rem" }}>表にない商品</strong>
                {extraLines.map((row) => (
                  <div key={row.id} className="row" style={{ gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 140px" }}>
                      <label style={{ fontSize: "0.8rem" }}>商品</label>
                      <select
                        value={row.productId}
                        onChange={(e) =>
                          setExtraLines((ls) =>
                            ls.map((x) => (x.id === row.id ? { ...x, productId: e.target.value } : x))
                          )
                        }
                      >
                        {activeProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: "5rem" }}>
                      <label style={{ fontSize: "0.8rem" }}>個数</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        value={row.qty}
                        onChange={(e) =>
                          setExtraLines((ls) => ls.map((x) => (x.id === row.id ? { ...x, qty: e.target.value } : x)))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtraLines((ls) => ls.filter((x) => x.id !== row.id))}
                      style={{ marginBottom: "0.15rem" }}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setExtraLines((ls) => [
                  ...ls,
                  { id: newExtraRowId(), productId: defaultProductIdForExtra(), qty: "" },
                ])
              }
              disabled={activeProducts.length === 0}
            >
              表にない商品を追加
            </button>

            <div>
              <label>日時（一括）</label>
              <input type="datetime-local" value={handWhen} onChange={(e) => setHandWhen(e.target.value)} />
            </div>
            <button type="submit" className="primary">
              まとめて記録する（在庫を減らす）
            </button>
          </form>

          <h3 style={{ fontSize: "1.05rem", marginTop: "1.25rem" }}>コース・売上の記録</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>税込合計</th>
                  <th>取消</th>
                  <th>メモ</th>
                </tr>
              </thead>
              <tbody>
                {summary.sales.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "#666" }}>
                      売上データがありません
                    </td>
                  </tr>
                ) : (
                  summary.sales.map((s) => (
                    <tr key={s.id} style={s.voided ? { opacity: 0.55 } : undefined}>
                      <td>{new Date(s.occurredAt).toLocaleString("ja-JP")}</td>
                      <td>¥{s.totalTaxIn.toLocaleString("ja-JP")}</td>
                      <td>{s.voided ? "はい" : "いいえ"}</td>
                      <td>{s.memo ?? ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: "1.05rem", marginTop: "1.25rem" }}>お渡し履歴（新しい順）</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>商品</th>
                  <th>数量</th>
                  <th>区分</th>
                  <th>理由</th>
                  <th>登録者</th>
                </tr>
              </thead>
              <tbody>
                {summary.handoutHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: "#666" }}>
                      まだお渡しの記録がありません
                    </td>
                  </tr>
                ) : (
                  summary.handoutHistory.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.occurredAt).toLocaleString("ja-JP")}</td>
                      <td>{h.productName}</td>
                      <td>{h.qty}</td>
                      <td>{h.source}</td>
                      <td>{h.reason ?? ""}</td>
                      <td>{h.registeredBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
