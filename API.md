# API Reference

Base path: `/api/v1`

All endpoints return JSON unless noted. Protected endpoints require:

```http
Authorization: Bearer <access_token>
```

Roles are `admin`, `researcher`, and `viewer`. Admins can access admin endpoints; researchers can create and manage jobs; viewers have read-only access to their own jobs.

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Liveness check. |
| `GET` | `/ready` | No | Database readiness check. Returns 503 when the database is unavailable. |

## Authentication

### `POST /auth/signup`

```json
{
  "email": "researcher@example.com",
  "password": "at-least-8-characters"
}
```

Creates a `researcher` account and returns access/refresh tokens.

### `POST /auth/login`

```json
{
  "email": "researcher@example.com",
  "password": "at-least-8-characters"
}
```

### `POST /auth/refresh`

```json
{
  "refresh_token": "<refresh_token>"
}
```

### `POST /auth/logout`

Requires a Bearer token. Records a logout timestamp so older tokens are rejected.

### `GET /auth/me`

Returns `{ id, email, role, is_active }`.

Token responses have the form:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "user": { "id": "...", "email": "...", "role": "researcher" }
}
```

## Research jobs

### `POST /research/jobs`

Requires `researcher` or `admin`.

```json
{
  "query": "How do urban green spaces affect public health?",
  "urls": ["https://example.org/paper"],
  "idempotency_key": "optional-client-key"
}
```

You can also send `Idempotency-Key` as a header. Keys are scoped to the authenticated account. Returns `202` with the job resource.

Job response fields:

```json
{
  "id": "uuid",
  "query": "...",
  "status": "pending",
  "current_stage": "pending",
  "stage": "pending",
  "progress": 0,
  "created_at": "2026-01-01T00:00:00Z",
  "error": null
}
```

The `stage` field is a convenience alias of `current_stage`.

Status values: `pending`, `running`, `scraping`, `summarizing`, `fact_checking`, `writing`, `editing`, `completed`, `failed`, `cancelled`.

### `GET /research/jobs`

Query parameters: `limit` (1-100, default 50), `offset` (default 0).

### `GET /research/jobs/{job_id}`

Returns the job if it belongs to the current user (admins can access any job).

### `GET /research/jobs/{job_id}/progress`

Server-Sent Events stream. Each event uses `event: progress` and a JSON data payload:

```json
{
  "job_id": "uuid",
  "status": "summarizing",
  "stage": "summarizing",
  "progress": 40
}
```

Authentication options:

- `Authorization: Bearer <access_token>` (used by the React client)
- `?token=<stream_token>` for `EventSource`

The stream closes when the job reaches `completed`, `failed`, or `cancelled`.

### `GET /research/jobs/{job_id}/stream-token`

Issues a short-lived token for the SSE endpoint:

```json
{ "stream_token": "..." }
```

### `POST /research/jobs/{job_id}/cancel`

Requests cancellation. The worker checks the flag between stages. Terminal jobs return `409`.

### `POST /research/jobs/{job_id}/resume`

Restarts a `failed` or `cancelled` job from the pending state. Other statuses return `409`.

### `GET /research/jobs/{job_id}/sources`

Returns sources for the job, including URL, title, status, word count, hashes, and error text.

### `GET /research/jobs/{job_id}/claims`

Returns claims with `claim_text`, `source_url`, `quote`, `confidence`, `verdict`, and `reason`.

Verdicts: `verified`, `disputed`, `unverified`. A claim without a quote that can be found in the scraped source is downgraded to `unverified`.

## Reports

### `GET /reports/{job_id}`

Returns report metadata and the full Markdown body.

### `GET /reports/{job_id}/download?format=pdf`

Returns a file response. Supported formats: `pdf`, `docx`, `markdown`.

`format=markdown` returns JSON:

```json
{ "markdown": "# Report..." }
```

Report access is checked against the job owner.

## Admin

All admin endpoints require the `admin` role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/providers` | Providers from `app/core/providers.yaml`, with key availability. |
| `POST` | `/admin/providers/{name}/toggle?enabled=true` | Toggle a provider in the YAML file. |
| `GET` | `/admin/providers/{name}/test` | Reachability check for a provider base URL. |
| `GET` | `/admin/usage` | Token/cost counters from `llm_usage` plus job counts. |
| `GET` | `/admin/jobs?limit=50` | Recent jobs across users. |

## Errors

FastAPI validation errors return `422`. Authorization failures return `401`/`403`. Missing or inaccessible resources return `404`. Conflicts such as cancelling a terminal job return `409`.

Example:

```json
{ "detail": "Cannot cancel a completed job" }
```
