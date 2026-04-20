import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  customerName: string;
  sales: SummarySale[];
  products: SummaryProduct[];
  handoutHistory: HandoutRow[];
};

export function CustomerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const nameFromUrl = searchParams.get("name") ?? "";

  const [nameInput, setNameInput] = useState(nameFromUrl);
  const [nameList, setNameList] = useState<string[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [activeProducts, setActiveProducts] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [handProductId, setHandProductId] = useState("");
  const [handQty, setHandQty] = useState(1);
  const [handWhen, setHandWhen] = useState(isoLocal(new Date()));

  const loadNames = useCallback(async () => {
    const res = await api<{ names: string[] }>("/api/customers/names");
    setNameList(res.names);
  }, []);

  const loadSummary = useCallback(async (customerName: string) => {
    const q = new URLSearchParams({ customerName });
    const res = await api<SummaryResponse>(`/api/customers/summary?${q.toString()}`);
    setSummary(res);
  }, []);

  useEffect(() => {
    loadNames().catch((e) => setErr(e instanceof Error ? e.message : "失敗"));
    (async () => {
      try {
        const res = await api<{ products: { id: string; name: string; active?: boolean }[] }>("/api/products");
        const list = res.products.filter((p) => (p as { active?: boolean }).active !== false);
        setActiveProducts(list);
        setHandProductId((prev) => prev || list[0]?.id || "");
      } catch {
        /* マスタ未取得でもカルテは使える */
      }
    })();
  }, [loadNames]);

  useEffect(() => {
    setNameInput(nameFromUrl);
    if (!nameFromUrl.trim()) {
      setSummary(null);
      return;
    }
    setErr(null);
    loadSummary(nameFromUrl.trim())
      .catch((e) => {
        setSummary(null);
        setErr(e instanceof Error ? e.message : "カルテの取得に失敗しました");
      });
  }, [nameFromUrl, loadSummary]);

  function openCart() {
    const n = nameInput.trim();
    if (!n) {
      setErr("お客様名を入力してください");
      return;
    }
    setErr(null);
    setSearchParams({ name: n });
  }

  async function submitHandout(e: React.FormEvent) {
    e.preventDefault();
    const customerName = nameFromUrl.trim();
    if (!customerName || !summary) return;
    setMsg(null);
    setErr(null);
    try {
      await api("/api/customers/handout", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          productId: handProductId,
          qty: handQty,
          occurredAt: new Date(handWhen).toISOString(),
        }),
      });
      setMsg("お渡しを記録し、在庫を減らしました");
      await loadSummary(customerName);
      await loadNames();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "記録に失敗しました");
    }
  }

  function pct(handed: number, planned: number) {
    if (planned <= 0) return handed > 0 ? 100 : 0;
    return Math.min(100, Math.round((handed / planned) * 100));
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>お客様カルテ</h1>
      <p style={{ fontSize: "0.95rem", color: "#444", marginTop: "-0.25rem" }}>
        コースで売上に載せた<strong>予定数量</strong>と、実際に渡した<strong>お渡し記録</strong>をまとめて見られます。カルテから記録すると<strong>在庫も自動で減ります</strong>。
      </p>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="card stack">
        <strong>お客様を選ぶ</strong>
        <div className="stack">
          <div>
            <label htmlFor="cust-name">お客様名</label>
            <input
              id="cust-name"
              list="customer-name-options"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="例：山田 花子"
              autoComplete="off"
            />
            <datalist id="customer-name-options">
              {nameList.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <button type="button" className="primary" onClick={openCart}>
            カルテを見る
          </button>
        </div>
      </div>

      {summary && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginTop: "1.25rem" }}>{summary.customerName} さん</h2>

          <div className="card stack" style={{ marginTop: "0.75rem" }}>
            <strong>商品別のお渡し状況</strong>
            <p style={{ fontSize: "0.88rem", color: "#555", margin: 0 }}>
              予定＝売上の物販明細の合計（取消済みは除く）。渡した＝カルテ記録＋その場で在庫を引いた販売。
            </p>
            <div className="stack" style={{ gap: "1rem" }}>
              {summary.products.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "#666" }}>このお客様の物販明細はまだありません。</p>
              ) : (
                summary.products.map((p) => {
                  const bar = pct(p.handedQty, p.plannedQty);
                  const over = p.remainingQty < 0;
                  return (
                    <div key={p.productId} style={{ borderBottom: "1px solid #eee", paddingBottom: "0.75rem" }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: "0.9rem", color: "#333", marginTop: "0.25rem" }}>
                        予定: {p.plannedQty} 個 ／ 渡した: {p.handedQty} 個 ／ 残り:{" "}
                        <span style={over ? { color: "#c62828", fontWeight: 600 } : undefined}>
                          {p.remainingQty} 個
                        </span>
                        {over && <span style={{ color: "#c62828", marginLeft: "0.35rem" }}>（予定を超えています）</span>}
                      </div>
                      <div
                        style={{
                          marginTop: "0.35rem",
                          height: "8px",
                          background: "#eee",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${bar}%`,
                            height: "100%",
                            background: over ? "#c62828" : "#2e7d32",
                            transition: "width 0.2s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card stack" style={{ marginTop: "0.75rem" }}>
            <strong>今日のお渡しを記録する</strong>
            <p style={{ fontSize: "0.88rem", color: "#555", margin: 0 }}>
              商品と数量を選んで「記録する」を押すと、在庫から自動で引かれます。
            </p>
            <form className="stack" onSubmit={submitHandout}>
              <div>
                <label>商品</label>
                <select value={handProductId} onChange={(e) => setHandProductId(e.target.value)}>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>数量</label>
                <input type="number" inputMode="numeric" min={1} value={handQty} onChange={(e) => setHandQty(Number(e.target.value))} />
              </div>
              <div>
                <label>日時</label>
                <input type="datetime-local" value={handWhen} onChange={(e) => setHandWhen(e.target.value)} />
              </div>
              <button type="submit" className="primary">
                記録する（在庫を減らす）
              </button>
            </form>
          </div>

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
