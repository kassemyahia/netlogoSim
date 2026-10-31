# 2026 production improvements

## Public preview boundary

The public API accepts only a numeric project ID and resolves the currently `active` submission with the service role. Drive IDs and OAuth credentials never cross the API boundary. The response is size-limited, rate-limited, `no-store`, `nosniff`, and `application/octet-stream` so navigating to the function does not render HTML.

The browser prepends a fixed restrictive CSP and creates a short-lived Blob URL. The viewer iframe has only `sandbox="allow-scripts"`; it intentionally lacks `allow-same-origin`, forms, popups, downloads, and top navigation. Its opaque origin cannot access the parent DOM, portal storage, cookies, or authentication state. Network access is disabled by CSP. Inline/eval/Wasm and Blob workers are allowed solely to preserve self-contained NetLogo Web exports. Exports requiring external URLs will not work; weakening the sandbox is not an accepted workaround.

## Upload lifecycle

The browser uses XHR only for measurable transfer progress. After transfer it switches to an indeterminate server-processing/Drive-saving state, then a short client-finalization state. The request has a 145-second timeout and can be aborted. Controls are restored on every failure. Project-list refresh runs after success and cannot keep the upload operation spinning.

The Edge Function validates ownership, filename, size, and content before creating an `uploading` record. A request UUID makes retries idempotent. Google Drive receives a resumable session in 4 MiB chunks with three bounded retries for transient failures. The previous active version is superseded only after Drive persistence and atomic database activation. Stale/cleanup states remain visible to the worker.

## Code recovery

Secure registrations derive codes from a private request UUID and `TEAM_SECRET_DERIVATION_KEY`; only the peppered hash is stored on the project. The private request UUID now has an indexed project link, allowing an authenticated admin to rederive a code and verify it against the current hash. This adds no plaintext backup. Legacy hashes and previously rotated codes are irrecoverable and use an owner-only random rotation. Audit rows include actor, action, project, time, and hashed IP—not codes.

## Test scope

Automated tests cover HTML/file bounds (small, 1 MiB, 7.4 MB, and 25 MiB), resumable ranges/retries/network failure, CSP insertion, iframe sandbox attributes, public member details, mobile dialogs, sheet ordering/formula neutralization/idempotent values, admin claim helpers, bigint IDs, authorization hashes, and atomic replacement behavior. Google/Drive/Sheets calls are mocked in unit/browser tests unless the final report explicitly says a production endpoint was exercised.
