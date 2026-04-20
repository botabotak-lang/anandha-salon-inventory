import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("owner@anandha.local");
  const [password, setPassword] = useState("changeme123");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const raw = await res.text();
      let data: { error?: string; detail?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        /* 非JSONのエラーページなど */
      }
      if (!res.ok) {
        const base = data.error ?? `ログインできませんでした（HTTP ${res.status}）`;
        setErr(data.detail ? `${base}\n${data.detail}` : base);
        return;
      }
      nav("/", { replace: true });
    } catch {
      setErr(
        "サーバーに接続できません。ターミナルで npm run dev を起動し、READMEの「要ログイン」の項を確認してください。"
      );
    }
  }

  return (
    <div className="wrap">
      <h1 style={{ fontSize: "1.35rem" }}>ログイン</h1>
      <p style={{ fontSize: "0.95rem", color: "#444" }}>
        初期アカウントは README を参照してください。
      </p>
      {err && <div className="alert error">{err}</div>}
      <form className="card stack" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email">メール</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
          />
        </div>
        <div>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="primary">
          ログイン
        </button>
      </form>
    </div>
  );
}
