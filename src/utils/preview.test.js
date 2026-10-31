import { describe, expect, it } from 'vitest';
import { hardenPreviewHtml, PREVIEW_CSP } from './preview';

describe('preview isolation', () => {
  it('places a restrictive CSP and inert base before untrusted scripts', () => {
    const malicious = '<!doctype html><script>top.location="https://evil.test"</script><form action="https://evil.test">';
    const hardened = hardenPreviewHtml(malicious);
    expect(hardened.indexOf('Content-Security-Policy')).toBeLessThan(hardened.indexOf('<script>'));
    expect(hardened).toContain('<base href="about:blank">');
    expect(PREVIEW_CSP).toContain("connect-src 'none'");
    expect(PREVIEW_CSP).toContain("form-action 'none'");
  });
});
