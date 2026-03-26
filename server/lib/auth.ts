import { SignJWT, jwtVerify } from "jose";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const COOKIE = "sid";
const TTL = "7d";

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET が短すぎるか未設定です（16文字以上）。");
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  sub: string;
  shopId: string;
  email: string;
  name: string;
};

export async function signSession(p: SessionPayload) {
  return new SignJWT({ shopId: p.shopId, email: p.email, name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    const shopId = payload.shopId as string | undefined;
    const email = payload.email as string | undefined;
    const name = payload.name as string | undefined;
    if (!sub || !shopId || !email || !name) return null;
    return { sub, shopId, email, name };
  } catch {
    return null;
  }
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function getSession(c: Context): Promise<SessionPayload | null> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  return verifySession(raw);
}
