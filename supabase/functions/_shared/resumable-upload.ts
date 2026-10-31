export type ResumableUploadOptions = {
  sessionUrl: string;
  token: string;
  bytes: Uint8Array;
  chunkSize?: number;
  fetcher?: typeof fetch;
  maxAttempts?: number;
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function uploadResumableChunks({
  sessionUrl,
  token,
  bytes,
  chunkSize = 4 * 1024 * 1024,
  fetcher = fetch,
  maxAttempts = 3,
}: ResumableUploadOptions) {
  if (chunkSize % (256 * 1024) !== 0) throw new Error('chunk_size_must_be_256k_aligned');
  let offset = 0;
  let finalPayload: { id?: string } | null = null;

  while (offset < bytes.length) {
    const endExclusive = Math.min(offset + chunkSize, bytes.length);
    const chunk = bytes.slice(offset, endExclusive);
    let response: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await fetcher(sessionUrl, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'text/html; charset=utf-8',
            'content-length': String(chunk.length),
            'content-range': `bytes ${offset}-${endExclusive - 1}/${bytes.length}`,
          },
          body: chunk,
          signal: AbortSignal.timeout(60_000),
        });
        if (response.status === 308 || response.ok || !RETRYABLE.has(response.status)) break;
        lastError = new Error(`retryable_google_status_${response.status}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt < maxAttempts) await wait(250 * 2 ** (attempt - 1));
    }

    if (!response) throw lastError || new Error('google_upload_network_error');
    if (response.status === 308) {
      const accepted = response.headers.get('range')?.match(/bytes=0-(\d+)/i)?.[1];
      offset = accepted ? Number(accepted) + 1 : endExclusive;
      continue;
    }
    if (!response.ok) throw new Error(`google_upload_status_${response.status}`);
    finalPayload = await response.json();
    offset = endExclusive;
  }

  if (!finalPayload?.id) throw new Error('google_upload_missing_id');
  return finalPayload as { id: string };
}
