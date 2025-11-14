# Frontend SPA – TMR Trading Lanka

React + Vite single-page application for dealership operations.

## Highlights

- **Authenticated workspace** – React Router + context-driven auth; Ant Design layout tuned for desktop workflows.
- **Modules** – Dashboard, bills, inventory, quotations/invoices, admin branding, verification prompts, user profile/preferences.
- **Styling** – TailwindCSS utility styling with Ant Design components and custom theming.
- **API client** – Axios instance (`src/config/apiClient.js`) injects tokens, handles refresh, and normalises errors.

## Directory Structure

```
frontend/
├── src/
│   ├── pages/          # Feature pages (bills, inventory, quotations, admin, auth)
│   ├── components/     # Reusable UI (navigation, protected routes, forms)
│   ├── contexts/       # Auth & theme providers
│   ├── services/       # API wrappers per module
│   ├── config/         # API client configuration
│   └── index.css       # Tailwind base styles
├── public/             # Static assets, Cloudflare headers/redirects
├── vite.config.js
└── tailwind.config.js
```

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

- SPA served at `http://localhost:5173`.
- Point `VITE_API_URL` to the backend (`http://localhost:8080` locally or `/api` behind Cloudflare proxy).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server. |
| `npm run build` | Production build to `dist/`. |
| `npm run build:prod` | Production build with `NODE_ENV=production`. |
| `npm run preview` | Preview built assets locally. |
| `npm run test` | Placeholder (manual QA currently). |
| `npm run lint` | Placeholder. |

## Environment Variables

Defined at build time. See [`../docs/setup/environment.md`](../docs/setup/environment.md) for complete reference.

```env
VITE_API_URL=http://localhost:8080
VITE_APP_NAME=TMR Trading Lanka
VITE_APP_DESCRIPTION=Motorcycle dealership ERP for sales, inventory, and quotations
```

## Auth Flow

1. Login form posts to `/api/auth/login`.
2. Access token stored in memory; refresh cookie handled automatically by backend.
3. `ProtectedRoute` component checks auth context and redirects to `/login` as needed.
4. API client attaches Bearer token and retries refresh flow on 401 responses.

## UI Considerations

- Dashboard summarises bills, inventory status, and recent activity.
- Forms reuse Ant Design components with Tailwind utility classes for layout.
- Branding context fetches `/api/branding` post-authentication to update titles, logos, and PDF previews.
- Dark mode leverages Tailwind's `class` strategy combined with Ant Design theme tokens.

## Deployment

- Built via `npm run build` and deployed to Cloudflare Pages (`frontend/dist`).
- `_redirects` file proxies `/api/*` to the Railway backend when configured.
- Zero Trust protects preview deployments; production remains public for staff.

Refer to [`../docs/setup/deployment.md`](../docs/setup/deployment.md) for platform-specific instructions.
