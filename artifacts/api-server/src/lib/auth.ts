import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hash, "hex");
  // timingSafeEqual throws (not returns false) on a length mismatch, which would
  // surface as a 500 instead of a failed login if the stored hash is malformed.
  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

// Simple JWT-like signed token using HMAC (no jsonwebtoken dependency needed)
import { createHmac } from "crypto";

const JWT_SECRET = process.env["JWT_SECRET"] || "smoothy-king-dev-secret-change-in-production";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload {
  userId: number;
  email: string;
  nickname: string;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function sign(payload: string): string {
  return createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
}

export function createToken(userId: number, email: string, nickname: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    nickname,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = sign(`${header}.${body}`);

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(base64UrlDecode(body!)) as TokenPayload;

    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
