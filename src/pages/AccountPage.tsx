import { useState } from "react";
import { api } from "../api";

export function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (newPassword.length < 8) {
      setErr("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    if (newPassword !== newPassword2) {
      setErr("新しいパスワード（確認）が一致しません。");
      return;
    }

    setSaving(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setMsg("パスワードを変更しました。");
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "変更できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>アカウント設定</h1>
      <p style={{ fontSize: "0.95rem", color: "#444" }}>
        パスワードは8文字以上で設定してください。オーナー用・スタッフ用をそれぞれ別に管理してください。
      </p>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <form className="card stack" onSubmit={onSubmit}>
        <div>
          <label htmlFor="currentPassword">現在のパスワード</label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label htmlFor="newPassword">新しいパスワード（8文字以上）</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label htmlFor="newPassword2">新しいパスワード（確認）</label>
          <input
            id="newPassword2"
            type="password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "変更中..." : "パスワードを変更"}
        </button>
      </form>
    </div>
  );
}
