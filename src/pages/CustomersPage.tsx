import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  active: boolean;
};

export function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);

  async function load() {
    const d = await api<{ customers: Customer[] }>("/api/customers");
    setRows(d.customers);
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "失敗"));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>お客様マスタ</h1>
      <p style={{ fontSize: "0.95rem", color: "#444", marginTop: "-0.25rem" }}>
        ここで登録したお客様を、<strong>お客様カルテ</strong>や<strong>売上入力</strong>から選べます。
      </p>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="card stack">
        <strong>新規登録</strong>
        <CustomerForm
          initial={null}
          onSave={async (body) => {
            setMsg(null);
            await api("/api/customers", { method: "POST", body: JSON.stringify(body) });
            setMsg("登録しました");
            await load();
          }}
        />
      </div>

      {rows.map((c) => (
        <div key={c.id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <strong>{c.name}</strong>
              {!c.active && (
                <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "#888" }}>（無効）</span>
              )}
            </div>
            <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
              <Link to={`/customers/${c.id}`}>カルテを開く</Link>
              {c.active && (
                <button type="button" onClick={() => setEditing(c)}>
                  編集
                </button>
              )}
              {c.active && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`${c.name} さんを無効にしますか？（データは残ります）`)) return;
                    setMsg(null);
                    setErr(null);
                    try {
                      await api(`/api/customers/${c.id}`, { method: "DELETE" });
                      setMsg("無効にしました");
                      await load();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "失敗");
                    }
                  }}
                >
                  無効化
                </button>
              )}
              {!c.active && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`${c.name} さんを完全に削除しますか？この操作は元に戻せません。`)) return;
                    setMsg(null);
                    setErr(null);
                    try {
                      await api(`/api/customers/${c.id}/purge`, { method: "DELETE" });
                      setMsg("完全削除しました");
                      await load();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "失敗");
                    }
                  }}
                >
                  完全削除
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: "0.95rem", color: "#444" }}>
            {c.phone && (
              <>
                電話: {c.phone}
                <br />
              </>
            )}
            {c.memo && <>メモ: {c.memo}</>}
            {!c.phone && !c.memo && <span style={{ color: "#999" }}>電話・メモなし</span>}
          </div>
          {editing?.id === c.id && (
            <CustomerForm
              initial={c}
              onSave={async (body) => {
                await api(`/api/customers/${c.id}`, { method: "PATCH", body: JSON.stringify(body) });
                setEditing(null);
                setMsg("更新しました");
                await load();
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CustomerForm({
  initial,
  onSave,
}: {
  initial: Customer | null;
  onSave: (p: { name: string; phone?: string | null; memo?: string | null; active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          name: name.trim(),
          phone: phone.trim() || null,
          memo: memo.trim() || null,
          ...(initial ? { active } : {}),
        });
        if (!initial) {
          setName("");
          setPhone("");
          setMemo("");
        }
      }}
    >
      <div>
        <label>お名前（必須）</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>電話番号</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="任意" />
      </div>
      <div>
        <label>メモ</label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="任意" />
      </div>
      {initial && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          有効
        </label>
      )}
      <button type="submit" className="primary">
        {initial ? "保存" : "登録する"}
      </button>
    </form>
  );
}
