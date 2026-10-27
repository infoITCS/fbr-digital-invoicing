# ITCS FBR Digital Invoicing (Sandbox)

Standalone MERN app for **ITCS** — Microsoft tenant login, invoice form, dashboard of submitted invoices, and FBR **sandbox** validate/submit.

## Quick start

### 1. Environment

Put values in **`server/.env`**:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=http://localhost:5173
FBR_ENVIRONMENT=sandbox
FBR_API_TOKEN=YOUR_ACTUAL_SANDBOX_BEARER_TOKEN
FBR_VALIDATE_URL=https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb
FBR_SUBMIT_URL=https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
AZURE_AD_TENANT_ID=your-itcs-tenant-guid
AZURE_AD_CLIENT_ID=your-app-registration-client-id
```

Never commit real tokens. Restart the backend after env changes.

### 2. Microsoft Entra ID app registration (required)

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: e.g. `ITCS FBR Digital Invoicing`
3. Supported account types: **Accounts in this organizational directory only (single tenant)**
4. Redirect URI: **Single-page application (SPA)** → `http://localhost:5173`  
   (Add your production HTTPS origin later, e.g. `https://invoice.yourdomain.com`)
5. After create, copy:
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID`
6. **Authentication** → enable **ID tokens** (used by this API)
7. Optional: **Token configuration** / branding as needed

Only users signed in to **this tenant** can use the app. The API also rejects tokens whose `tid` claim does not match `AZURE_AD_TENANT_ID`.

### 3. Run

```bash
cd server
npm install
npm run dev

cd ../client
npm install
npm run dev
```

- Login: http://localhost:5173/login  
- Form: http://localhost:5173/  
- Dashboard: http://localhost:5173/dashboard  
- Health: http://localhost:5000/api/health  

### 4. FBR flow (after sign-in)

1. **Save Draft** → MongoDB  
2. **Validate with FBR** → sandbox validate  
3. **Submit to FBR** → only when status is `validated`  
4. Submitted invoices appear on **Dashboard**

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Readiness |
| `GET` | `/api/auth/config` | Public | MSAL tenant/client IDs (no secrets) |
| `GET` | `/api/auth/me` | Microsoft | Current user |
| `GET` | `/api/invoices/dashboard` | Microsoft | Stats + submitted list |
| `POST` | `/api/invoices` | Microsoft | Create draft |
| `PUT` | `/api/invoices/:id` | Microsoft | Update draft |
| `POST` | `/api/invoices/:id/validate` | Microsoft | Validate with FBR |
| `POST` | `/api/invoices/:id/submit` | Microsoft | Submit to FBR |

## Tests

```bash
cd server
npm test
```

Tests use `AUTH_DISABLED=true` and mocked FBR — they never call the real gateway.

## SN005 / extraTax

See [`server/docs/SN005-EXTRATAX.md`](server/docs/SN005-EXTRATAX.md).

## Plesk

- MongoDB Atlas for `MONGODB_URI`
- Node app root: `server/` → `src/index.js`
- Build client and host `client/dist`
- Set `CLIENT_ORIGIN` to the live HTTPS origin
- Add the same HTTPS origin as an SPA redirect URI in Entra ID
- Keep sandbox FBR URLs until production is authorized
