import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="wrap">
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>Anandah 在庫・売上</strong>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.href = "/login";
          }}
        >
          ログアウト
        </button>
      </header>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          ダッシュボード
        </NavLink>
        <NavLink to="/sales/new" className={({ isActive }) => (isActive ? "active" : "")}>
          売上入力
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => (isActive ? "active" : "")}>
          売上一覧
        </NavLink>
        <NavLink to="/customers" className={({ isActive }) => (isActive ? "active" : "")}>
          お客様マスタ
        </NavLink>
        <NavLink to="/stock" className={({ isActive }) => (isActive ? "active" : "")}>
          在庫
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : "")}>
          物販マスタ
        </NavLink>
        <NavLink to="/services" className={({ isActive }) => (isActive ? "active" : "")}>
          施術マスタ
        </NavLink>
        <NavLink to="/courses" className={({ isActive }) => (isActive ? "active" : "")}>
          コースマスタ
        </NavLink>
        <NavLink to="/monthly" className={({ isActive }) => (isActive ? "active" : "")}>
          月次
        </NavLink>
        <NavLink to="/csv" className={({ isActive }) => (isActive ? "active" : "")}>
          CSV
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")}>
          設定
        </NavLink>
      </nav>
      <main>{children}</main>
    </div>
  );
}
