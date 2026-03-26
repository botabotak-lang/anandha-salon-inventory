import { useState } from "react";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CsvPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return isoLocal(d);
  });
  const [to, setTo] = useState(isoLocal(new Date()));

  const href = `/api/export/csv?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem" }}>CSVダウンロード</h1>
      <p style={{ fontSize: "0.95rem", color: "#444" }}>
        期間を選んでダウンロードします。顧客名が含まれます。保存先と共有範囲にご注意ください。
      </p>
      <div className="card stack">
        <div>
          <label>開始</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>終了</label>
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <a className="row" href={href} style={{ display: "inline-flex", textDecoration: "none" }}>
          <button type="button" className="primary">
            CSVを取得
          </button>
        </a>
      </div>
    </div>
  );
}
