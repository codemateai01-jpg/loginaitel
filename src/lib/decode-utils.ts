/**
 * Utilities for decoding encoded data from the secure proxies.
 * The proxies encode sensitive data (transcript, summary, extracted_data, notes) 
 * so it's not readable in browser DevTools network tab, but can be decoded here for display.
 */

/**
 * Decode a value that was encoded by the proxy.
 * Encoded values start with "enc:" prefix followed by base64.
 */
export function decodeEncodedValue(value: string | null | undefined): string | null {
  if (!value) return null;
  
  // Check for our encoding prefix
  if (typeof value === "string" && value.startsWith("enc:")) {
    try {
      const base64 = value.slice(4); // Remove "enc:" prefix
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      // If decode fails, try simple atob
      try {
        return atob(value.slice(4));
      } catch {
        // If all decoding fails, return original (might be a real value)
        return value;
      }
    }
  }
  
  // Not encoded, return as-is
  return value;
}

/**
 * Decode transcript from proxy response
 */
export function decodeTranscript(transcript: string | null | undefined): string | null {
  return decodeEncodedValue(transcript);
}

/**
 * Decode summary from proxy response
 */
export function decodeSummary(summary: string | null | undefined): string | null {
  return decodeEncodedValue(summary);
}

/**
 * Decode extracted_data from proxy response
 * Returns parsed JSON if the decoded value is valid JSON, otherwise the string
 */
export function decodeExtractedData(extractedData: string | null | undefined): unknown | null {
  const decoded = decodeEncodedValue(extractedData);
  if (!decoded) return null;
  
  try {
    return JSON.parse(decoded);
  } catch {
    // Not JSON, return as string
    return decoded;
  }
}

/**
 * Decode notes from proxy response
 */
export function decodeNotes(notes: string | null | undefined): string | null {
  return decodeEncodedValue(notes);
}

/**
 * Check if a value is encoded
 */
export function isEncoded(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("enc:");
}
