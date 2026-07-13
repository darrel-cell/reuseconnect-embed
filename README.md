# ReuseConnect Embed

Client-only portal for embedding inside partner websites via iframe. Users are signed in through a partner backend handshake — no second login.

## Dev

```bash
npm install
npm run dev
```

Runs on [http://localhost:8081](http://localhost:8081) and proxies `/api` to `http://localhost:3000`.

Set on the backend:

```env
EMBED_FRONTEND_URL=http://localhost:8081
CORS_ORIGIN=http://localhost:8080,http://localhost:8081
```

For end-to-end testing with a real partner-shaped app, use `reuseconnect-partner-test` (Next.js) instead of any in-app mock page.

## Partner integration

1. Super-admin enables **Iframe embed portal** on the referral partner (allowed origins + API key).
2. Partner backend (server-to-server) calls `POST /api/embed/session`.

### New user (full profile)

```http
POST /api/embed/session
X-Embed-Api-Key: rc_embed_...
Content-Type: application/json

{
  "externalUserId": "partner-user-123",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@acme.com",
  "phone": "+44...",
  "organisationName": "Acme Ltd",
  "registrationNumber": "12345678",
  "vatNumber": "GB123456789",
  "address": "1 High Street, London"
}
```

Optional fields: `phone`, `organisationName`, `registrationNumber`, `vatNumber`, `address`, `externalUserId`.

### Returning user (already registered)

```http
POST /api/embed/session
X-Embed-Api-Key: rc_embed_...
Content-Type: application/json

{
  "email": "jane@acme.com"
}
```

If the email is not registered, the API returns an error asking for the full profile payload.

3. Response includes `embedPath` like `/p/{slug}?token=...`.
4. Partner page embeds:

```html
<iframe
  src="https://embed.example.com/p/{slug}?token=..."
  style="width:100%;height:100%;border:0"
  allow="clipboard-write"
></iframe>
```

5. The embed app exchanges the one-time token for a session JWT and opens the client portal (partner logo + “Powered by ReuseConnect”).

## Security notes

- API key never goes in the browser — only the partner backend.
- Embed token is single-use and expires in ~5 minutes.
- Session JWT is stored in `sessionStorage` and sent as `Authorization: Bearer`.
- Parent `document.referrer` origin is validated against the partner allowlist when available.
