import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const MGMT_PATH_PREFIXES = [
  "/sales",
  "/stock",
  "/monthly",
  "/csv",
  "/customers",
  "/products",
  "/services",
  "/courses",
  "/account",
];

function isMgmtPath(pathname: string) {
  return MGMT_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function Layout({ children }: { children: ReactNode }) {
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const mgmtRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = mgmtRef.current;
      if (!el || !mgmtOpen) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMgmtOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [mgmtOpen]);

  const mgmtActive = isMgmtPath(location.pathname);

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
        <NavLink to="/karte" className={({ isActive }) => (isActive ? "active" : "")}>
          お客様カルテ
        </NavLink>
        <div className="nav-dropdown" ref={mgmtRef}>
          <button
            type="button"
            className={`nav-dropdown-trigger${mgmtActive ? " active" : ""}`}
            aria-expanded={mgmtOpen}
            aria-haspopup="true"
            onClick={() => setMgmtOpen((o) => !o)}
          >
            管理メニュー ▼
          </button>
          {mgmtOpen && (
            <div className="nav-dropdown-panel" role="menu">
              <NavLink
                to="/sales/new"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setMgmtOpen(false)}
              >
                売上入力
              </NavLink>
              <NavLink
                to="/sales"
                className={() => {
                  const p = location.pathname;
                  const onListOrDetail = p === "/sales" || (p.startsWith("/sales/") && !p.startsWith("/sales/new"));
                  return onListOrDetail ? "active" : "";
                }}
                onClick={() => setMgmtOpen(false)}
              >
                売上一覧
              </NavLink>
              <NavLink to="/stock" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                在庫
              </NavLink>
              <NavLink to="/monthly" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                月次
              </NavLink>
              <NavLink to="/csv" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                CSV
              </NavLink>
              <NavLink
                to="/customers"
                end
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setMgmtOpen(false)}
              >
                お客様マスタ
              </NavLink>
              <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                物販マスタ
              </NavLink>
              <NavLink to="/services" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                施術マスタ
              </NavLink>
              <NavLink to="/courses" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                コースマスタ
              </NavLink>
              <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setMgmtOpen(false)}>
                設定
              </NavLink>
            </div>
          )}
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
