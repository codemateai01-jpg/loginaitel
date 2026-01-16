import { useQuery } from "@tanstack/react-query";
import { 
  fetchDecryptedContent, 
  isEncryptedPayload, 
  EncryptedPayload,
  DecryptRequest 
} from "@/lib/secure-decrypt";

interface UseDecryptedContentOptions {
  field: unknown;
  resourceId: string;
  resourceType: "call" | "demo_call";
  fieldType: DecryptRequest["type"];
  enabled?: boolean;
}

/**
 * React hook for decrypting sensitive content.
 * Handles caching, loading states, and errors automatically.
 */
export function useDecryptedContent({
  field,
  resourceId,
  resourceType,
  fieldType,
  enabled = true,
}: UseDecryptedContentOptions) {
  // If it's a plain string, return it directly without making API call
  const isPlainString = typeof field === "string";
  const isEncrypted = isEncryptedPayload(field);

  return useQuery({
    queryKey: ["decrypted-content", resourceId, resourceType, fieldType],
    queryFn: async () => {
      if (isPlainString) {
        return field as string;
      }

      if (isEncrypted) {
        const decrypted = await fetchDecryptedContent({
          type: fieldType,
          resource_id: resourceId,
          resource_type: resourceType,
          encrypted_payload: field as EncryptedPayload,
        });
        return decrypted;
      }

      return null;
    },
    enabled: enabled && (isPlainString || isEncrypted) && !!resourceId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Batch decrypt multiple fields at once
 */
export function useDecryptedFields({
  resourceId,
  resourceType,
  fields,
  enabled = true,
}: {
  resourceId: string;
  resourceType: "call" | "demo_call";
  fields: {
    transcript?: unknown;
    summary?: unknown;
    notes?: unknown;
    extracted_data?: unknown;
  };
  enabled?: boolean;
}) {
  const transcript = useDecryptedContent({
    field: fields.transcript,
    resourceId,
    resourceType,
    fieldType: "transcript",
    enabled: enabled && !!fields.transcript,
  });

  const summary = useDecryptedContent({
    field: fields.summary,
    resourceId,
    resourceType,
    fieldType: "summary",
    enabled: enabled && !!fields.summary,
  });

  const notes = useDecryptedContent({
    field: fields.notes,
    resourceId,
    resourceType,
    fieldType: "notes",
    enabled: enabled && !!fields.notes,
  });

  const extractedData = useDecryptedContent({
    field: fields.extracted_data,
    resourceId,
    resourceType,
    fieldType: "extracted_data",
    enabled: enabled && !!fields.extracted_data,
  });

  return {
    transcript,
    summary,
    notes,
    extractedData,
    isLoading: transcript.isLoading || summary.isLoading || notes.isLoading || extractedData.isLoading,
    isError: transcript.isError || summary.isError || notes.isError || extractedData.isError,
  };
}
