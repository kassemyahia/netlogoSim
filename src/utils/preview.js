export const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:; connect-src 'none'; frame-src 'none'; child-src blob:; form-action 'none'; base-uri 'none'";

export function hardenPreviewHtml(html) {
  const guard = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><base href="about:blank">`;
  return `${guard}${String(html || '').replace(/^\s*<!doctype[^>]*>/i, '')}`;
}
