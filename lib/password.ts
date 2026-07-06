import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const passwordHashVersion = "scrypt:v1";
const saltBytes = 16;
const keyBytes = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(saltBytes).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, keyBytes)) as Buffer;

  return `${passwordHashVersion}:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, version, salt, hash] = storedHash.split(":");

  if (`${algorithm}:${version}` !== passwordHashVersion || !salt || !hash) {
    return false;
  }

  const storedKey = Buffer.from(hash, "base64url");
  const suppliedKey = (await scryptAsync(password, salt, storedKey.length)) as Buffer;

  if (storedKey.length !== suppliedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, suppliedKey);
}
