import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encrypted: boolean;
  alg: string;
}

export interface DecryptRequest {
  type: "transcript" | "summary" | "notes" | "extracted_data";
  resource_id: string;
  resource_type: "call" | "demo_call";
  encrypted_payload: EncryptedPayload;
}

/**
 * Fetches decrypted content from the secure backend endpoint.
 * This is the ONLY way to decrypt sensitive content - decryption keys
 * never leave the server.
 */
export async function fetchDecryptedContent(
  request: DecryptRequest
): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  // Validate the payload is actually encrypted
  if (!request.encrypted_payload?.encrypted || !request.encrypted_payload?.ciphertext) {
    console.warn("Payload is not encrypted or missing ciphertext");
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/decrypt-content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Decryption failed" }));
    throw new Error(error.error || "Failed to decrypt content");
  }

  const result = await response.json();
  return result.decrypted_content ?? result.content ?? null;
}

/**
 * Helper to check if a value is an encrypted payload
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.encrypted === true &&
    typeof obj.ciphertext === "string" &&
    typeof obj.iv === "string" &&
    obj.alg === "AES-256-GCM"
  );
}

/**
 * Hook-friendly decryption that handles the async nature
 */
export async function decryptFieldIfNeeded(
  field: unknown,
  resourceId: string,
  resourceType: "call" | "demo_call",
  fieldType: DecryptRequest["type"]
): Promise<string | null> {
  // If it's a plain string (legacy unencrypted data), return as-is
  if (typeof field === "string") {
    return field;
  }

  // If it's an encrypted payload, decrypt it
  if (isEncryptedPayload(field)) {
    return fetchDecryptedContent({
      type: fieldType,
      resource_id: resourceId,
      resource_type: resourceType,
      encrypted_payload: field,
    });
  }

  return null;
}
