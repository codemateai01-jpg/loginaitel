/**
 * AES-256-GCM Encryption utilities for secure transcript/summary handling.
 * Keys MUST exist only in server environment variables.
 */

// Get encryption key from environment - NEVER expose this
function getEncryptionKey(): ArrayBuffer {
  const keyHex = Deno.env.get("TRANSCRIPT_ENCRYPTION_KEY");
  if (!keyHex || keyHex.length < 32) {
    throw new Error("TRANSCRIPT_ENCRYPTION_KEY not configured or too short");
  }
  // Use first 32 bytes (256 bits) for AES-256
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyHex.slice(0, 32));
  // Convert to ArrayBuffer (not Uint8Array) to avoid type issues
  return keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength);
}

// Generate random IV (12 bytes for GCM)
function generateIV(): ArrayBuffer {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength);
}

// Convert ArrayBuffer to hex string
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex string to ArrayBuffer
function fromHex(hex: string): ArrayBuffer {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new ArrayBuffer(0);
  const arr = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
}

export interface EncryptedPayload {
  // Encrypted data in hex (includes GCM auth tag)
  ciphertext: string;
  // Initialization vector in hex
  iv: string;
  // This flag indicates the data is AES-256-GCM encrypted
  encrypted: true;
  // Algorithm identifier for verification
  alg: "AES-256-GCM";
}

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Returns an encrypted payload that is NOT reversible without the key.
 */
export async function encryptData(plaintext: string): Promise<EncryptedPayload> {
  if (!plaintext) {
    return {
      ciphertext: "",
      iv: "",
      encrypted: true,
      alg: "AES-256-GCM",
    };
  }

  const keyBuffer = getEncryptionKey();
  const ivBuffer = generateIV();
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext).buffer;

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Encrypt with AES-256-GCM (auth tag is appended automatically - last 16 bytes)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      tagLength: 128, // 16 bytes auth tag
    },
    cryptoKey,
    plaintextBuffer
  );

  return {
    ciphertext: toHex(ciphertextBuffer),
    iv: toHex(ivBuffer),
    encrypted: true,
    alg: "AES-256-GCM",
  };
}

/**
 * Decrypt data that was encrypted with encryptData.
 * This should ONLY be called in secure backend endpoints after auth checks.
 */
export async function decryptData(payload: EncryptedPayload): Promise<string> {
  if (!payload.ciphertext || !payload.iv) {
    return "";
  }

  const keyBuffer = getEncryptionKey();
  const ivBuffer = fromHex(payload.iv);
  const ciphertextBuffer = fromHex(payload.ciphertext);

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt with AES-256-GCM
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      tagLength: 128,
    },
    cryptoKey,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintextBuffer);
}

/**
 * Check if a value is an encrypted payload
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted" in value &&
    (value as EncryptedPayload).encrypted === true &&
    "alg" in value &&
    (value as EncryptedPayload).alg === "AES-256-GCM" &&
    "ciphertext" in value &&
    "iv" in value
  );
}
