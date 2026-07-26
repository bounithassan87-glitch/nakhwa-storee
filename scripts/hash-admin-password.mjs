// Generate an ADMIN_PASSWORD_HASH for .dev.vars / Pages secret.
// Uses the same PBKDF2 format the Worker verifies (pbkdf2$iter$salt$hash, b64url).
//   node scripts/hash-admin-password.mjs "MyStrongPassword"
const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "<password>"');
  process.exit(1);
}

const ITER = 100_000;
const enc = new TextEncoder();
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, key, 256);

console.log(`pbkdf2$${ITER}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`);
