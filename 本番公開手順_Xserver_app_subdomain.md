# 本番公開手順（`app.anandah57.com`）

この手順は、ホームページ（`www.anandah57.com`）を壊さずに、在庫アプリだけを `app.anandah57.com` で公開するためのものです。

## 0. 先に決まっていること

- 本番URL: `app.anandah57.com`
- 料金: 無料優先
- スマホ: ホーム画面追加したい（PWA）

---

## 1. Render で本番を作る（エンジニア作業）

1. Render にログインし、`New +` -> `Web Service`
2. GitHub の `salon-inventory-app` を選択
3. 設定
   - `Build Command`: `npm install && npm run build`
   - `Start Command`: `npm run start`
   - `Plan`: `Free`
4. 環境変数を設定
   - `NODE_ENV=production`
   - `DATABASE_URL=...`（まずは無料のDBを接続）
   - `SESSION_SECRET=...`（長いランダム文字）
5. デプロイ完了後、`https://xxxx.onrender.com/health` が `{"ok":true}` なら起動OK

> 補足: 無料枠は止まることがあるため、最初の表示に少し時間がかかることがあります。

---

## 2. Xserver 側の設定（オーナー作業）

Render 側で「Custom Domains」に `app.anandah57.com` を追加すると、接続先（CNAME）が表示されます。  
その値を Xserver に入れます。

1. Xserver のサーバーパネルにログイン
2. `DNSレコード設定` を開く（対象ドメイン: `anandah57.com`）
3. 以下の1行を追加
   - 種別: `CNAME`
   - ホスト名: `app`
   - 値: Render が表示する接続先（例: `xxxx.onrender.com`）
4. 保存

反映には数分〜最大24時間かかることがあります（通常はもっと早い）。

---

## 3. 動作確認

1. `https://app.anandah57.com/health` で `{"ok":true}` が出る
2. `https://app.anandah57.com` を開いてログイン
3. iPhone/Android で「ホーム画面に追加」

---

## 4. 公開直後に必ずやること

1. オーナー・スタッフ両方のパスワードを `設定` 画面で変更
2. その月の運用テスト（売上1件、入庫1件、CSV1回）
3. 月末CSV保存をカレンダーに登録

---

## 5. トラブル時

- `要ログイン` だけ出る: デプロイ直後の再起動待ち、またはブラウザの再読み込み
- 画面が開かない: DNS反映待ちの可能性。時間をおいて再確認
- `health` がNG: Render のログを確認

