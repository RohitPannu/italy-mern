# Deployment guide

## Current deployment design

The project is configured as one Render Node web service. Render installs the frontend dependencies, builds Vite into `client/dist`, installs the server dependencies, then starts Express. Express serves the SPA and `/api` from the same origin. The Blueprint is [../render.yaml](../render.yaml).

Deployment is not yet complete. The client must authorize access to the Render and source-code hosting accounts, provide a production MongoDB connection, and configure a production mail provider. Do not enter credentials in source files or these documents.

## Render service

1. The client creates or selects a Render account and owns the service.
2. Connect the approved private source repository and apply the Blueprint.
3. Use the build command `npm ci --prefix client && npm run build --prefix client && npm ci --prefix server`.
4. Use the start command `npm start --prefix server`.
5. Keep the service on the no-cost plan unless the client explicitly approves a paid plan. Confirm the plan’s current limits and sleep behavior in Render before launch.
6. Configure the following environment values in Render's secret environment settings:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` (set by the Blueprint) |
| `JWT_ACCESS_SECRET` | Generate a distinct secure value in Render (set to generate by the Blueprint). |
| `JWT_REFRESH_SECRET` | Generate a distinct secure value in Render (set to generate by the Blueprint). |
| `TOKEN_ENC_KEY` | Generate a distinct secure value in Render (set to generate by the Blueprint). |
| `MONGO_URI` | Client-owned production MongoDB connection string. |
| `CLIENT_URL` | Exact public website URL, including `https://`, without a trailing slash. |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins, with no trailing slashes. Include the website origin and any approved custom-domain origin. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Client-owned SMTP connection settings. The default port is 587. |
| `MAIL_FROM` | Verified sender address for the client. |
| `COOKIE_DOMAIN` | Leave unset for the combined single-origin service unless cross-subdomain cookies are explicitly needed. |

`CLIENT_URL` and `ALLOWED_ORIGINS` must be updated after Render assigns the service URL and again if a custom domain is connected. Keep the access, refresh, and encryption secrets unique. Never use a `VITE_` variable for a secret.

## MongoDB Atlas

1. The client creates and owns the Atlas organization/project and production cluster.
2. Create a dedicated least-privilege database user for the app. Use a strong generated password and keep it only in the approved password manager and Render secret settings.
3. Permit network access from the deployed Render service using Atlas's supported secure network-access setup. Avoid broad public access unless necessary and explicitly accepted by the client.
4. Set `MONGO_URI` in Render. Do not place it in Git, a ticket, or these documents.
5. Take a backup/snapshot before any production data operation.

The application connects before listening; startup exits on a connection failure. Mongoose models define the collections and indexes. There is no separate migration framework in this repository.

## Initial catalogue and admin account

The public catalogue is read from MongoDB. The bundled records are available in `server/data/`, and `npm run seed --prefix server` is the provided catalogue seed command. **Do not run it against an existing or unverified production database:** the script deletes and replaces catalogue collections, including with its default invocation when no programs are present. Verify the target database is new and empty, take a backup, and obtain client authorization before any seed operation. It is not run automatically during deployment.

Public registration creates student-role users. This project has no public admin-registration or documented safe admin-bootstrap command. Before launch, the client must approve a secure initial admin provisioning procedure; do not promote an account through the public registration form or share admin credentials in chat.

## Health checks and verification

Render is configured to check `/api/health`. Express begins listening only after MongoDB connects. After deploy, confirm the health endpoint and homepage return successfully, static assets load, and API routes use the same HTTPS origin.

Authentication cookies are HTTPS-only in production, `HttpOnly` for access and refresh tokens, and `SameSite=Lax`; the CSRF cookie is readable by the browser as required by the client. Express trusts one proxy hop in production for secure proxy handling.

## Custom domain and HTTPS

Add the domain in the Render service's Custom Domains settings. Copy the exact DNS records shown by Render into the client's domain registrar; DNS targets vary and should not be guessed. Wait for Render to validate DNS and issue TLS, then verify HTTPS on the root and `www` names if both are configured. Configure the desired redirect in Render or DNS only after confirming the canonical hostname. Update `CLIENT_URL` and `ALLOWED_ORIGINS` after domain changes.

## Troubleshooting

- **Service exits on startup:** review Render logs for the missing environment variable or MongoDB connection failure; do not paste secret-bearing logs into public channels.
- **CORS errors:** compare the browser's exact origin with `ALLOWED_ORIGINS`; origins must include scheme and hostname and omit a trailing slash.
- **Email not delivered:** verify the provider's host, port, authentication, sender verification, and delivery logs.
- **Static page but empty catalogue:** confirm approved catalogue initialization was performed against the intended database.
- **Health check fails:** check the Render service logs and MongoDB availability; do not disable the health check to mask a connection problem.
