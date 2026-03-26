import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Vite の proxy（vite.config.ts）と揃える。未設定時は 3002。
const port = Number(process.env.PORT) || 3002;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API http://127.0.0.1:${info.port}`);
});
