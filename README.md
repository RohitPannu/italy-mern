# Study in Italy

A MERN web application that helps Pakistani students explore Italian universities, degree programs, scholarships, admissions timelines, and application preparation. It includes public information pages, student accounts and saved planning tools, and a role-protected administration area for maintaining catalogue content.

## Features

- Browse Italian regions, universities, bachelor's and master's programs, intakes, and deadlines.
- Explore scholarships and DSU funding guidance, admissions steps, and application checklists.
- Register and authenticate students, verify email, recover passwords, and manage saved programs and checklist progress.
- Collect prospective-student leads.
- Provide role-protected admin tools for universities, programs, scholarship calls, announcements, and CSV import.
- Serve the Vite-built website from the Express server in production.

## Technology

- Client: React `^18.3.1`, React DOM `^18.3.1`, Vite `^5.4.0`, `@vitejs/plugin-react` `^4.3.1`.
- Server: Node.js, Express `^4.19.2`, Mongoose `^8.5.0`, MongoDB.
- Authentication and security: Argon2 `^0.45.1`, JSON Web Tokens, Helmet `^8.3.0`, CORS, validation, rate limiting, and cookie-based sessions.
- Email: Nodemailer `^10.0.16`.
- Tests: Jest `^30.5.2`, Supertest `^7.3.1`, and Node's built-in test runner.
- The exact dependency resolutions are recorded in the client and server npm lockfiles.

## Project Structure

```text
client/                 React application and Vite configuration
	src/                  Pages, components, API helpers, and styles
	.env.example          Development proxy example
server/                 Express API and application services
	data/                 Seed/catalogue data and CSV templates
	models/               Mongoose authentication models
	scripts/              Data audit, CSV import, and utility tests
	services/             Email, password, and security services
	tests/                Authentication integration tests
	.env.example          Server configuration example
render.yaml             Render Blueprint configuration
README.md               Setup and handover documentation
```

Local `.env` files, dependencies, generated build output, test output, generated reports, and logs are not source files and should remain uncommitted. See the [client handover guides](./handover/README.md) for deployment, administration, maintenance, and ownership checklists.

## Prerequisites

- Node.js 22.x or 24.x LTS and npm (use a currently supported Node.js LTS release).
- MongoDB running locally, or a MongoDB Atlas database. A local MongoDB instance is convenient for development.
- SMTP credentials and a sender address are needed to deliver verification and password-recovery email. They are not required for local development.

## Installation And Development

From the project root in PowerShell, create local environment files and install the locked dependencies:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env.local
npm ci --prefix server
npm ci --prefix client
```

Set `MONGO_URI` in `server/.env` to the local or development database. The example uses `mongodb://127.0.0.1:27017/italy`. Set each of `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `TOKEN_ENC_KEY` to a different random value of at least 32 characters. Generate a value locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command separately for each variable and keep the values in the ignored `server/.env` file. Never use these development values in production.

Start the API and frontend in separate terminals from the project root:

```powershell
npm run dev --prefix server
```

```powershell
npm run dev --prefix client
```

The frontend is available at `http://localhost:5173`; the API listens on `http://localhost:5005`. Vite proxies `/api` requests to the API. Change `VITE_API_PROXY` in `client/.env.local` if the API uses another origin.

To load the bundled catalogue into a fresh local database only:

```powershell
npm run seed --prefix server
```

The seed script may replace catalogue collections when it determines the database is unseeded. Never use `--force` on a database containing application-managed data; it erases catalogue edits. Do not run seeding against production unless the client has explicitly approved the operation and a recovery plan is in place.

## Environment Configuration

Copy the example files to local files as shown above. Real `.env` files are ignored by Git. Keep production credentials in the hosting provider's secret environment configuration, not in source files or README content.

Server variables:

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Set to `production` in production | Enables production security checks and cookie behavior. |
| `PORT` | Optional; defaults to `5005` | HTTP port. Hosting platforms may supply this value. |
| `MONGO_URI` | Required for the running application; local default is provided | MongoDB connection string. Use a production database user with least privilege. |
| `JWT_ACCESS_SECRET` | Required in every environment; at least 32 characters | Signs access tokens. Use a unique random secret. |
| `JWT_REFRESH_SECRET` | Required in every environment; at least 32 characters | Signs refresh tokens; must differ from all other secrets. |
| `TOKEN_ENC_KEY` | Required in every environment; at least 32 characters | Token encryption key; use a unique random value. |
| `CLIENT_URL` | Required in production | Exact public frontend origin used in email links. |
| `ALLOWED_ORIGINS` | Required in production | Comma-separated trusted frontend origins; use exact origins. |
| `COOKIE_DOMAIN` | Optional | Set only when cookie sharing across subdomains is required. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Required in production | SMTP server, credentials, and deliverable sender address. |
| `SMTP_PORT` | Optional; defaults to `587` | SMTP server port. |
| `MONGO_TEST_URI` | Optional, test-only | Use only for a dedicated disposable test database; see [Testing](#testing). |

Client variable:

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `VITE_API_PROXY` | Optional; defaults to `http://localhost:5005` | Development-only Vite proxy target for `/api` requests. |

Any variable prefixed with `VITE_` is compiled into browser-delivered code. It must never contain a password, token, API key, or other secret. The client currently uses a relative `/api` path in normal mode; `VITE_API_PROXY` configures the development server proxy rather than a production API credential or secret.

The application reads authentication and encryption secrets only from environment variables. Startup rejects missing, short, or reused secrets. Production startup also requires a MongoDB URI, public client URL, allowed frontend origins, and email settings.

## Database And Data

The application uses MongoDB through Mongoose. Keep development, test, and production databases separate. Restrict production database network access and credentials to the deployed service. Do not commit database dumps, local database files, backups, or real connection strings.

Seed catalogue data only into a fresh database. The seed script replaces program, university, and region collections when no programs exist; `--force` explicitly resets those collections. Admin-managed catalogue content and student/authentication records should be backed up using the database provider's approved backup process before any maintenance operation.

## Commands

| Purpose | Command from project root |
| --- | --- |
| Start API with file watching | `npm run dev --prefix server` |
| Start frontend dev server | `npm run dev --prefix client` |
| Build frontend | `npm run build --prefix client` |
| Build standalone preview output | `npm run preview:single --prefix client` |
| Start API for production | `npm start --prefix server` |
| Seed a fresh database | `npm run seed --prefix server` |
| Create the first admin (one-time, production only) | `npm run create-admin --prefix server` |
| Run backend integration tests | `npm test --prefix server` |
| Run database-independent Node utility tests | `node --test server/scripts/auth-utils.test.js server/scripts/audit.test.js` |
| Run catalogue audit (writes a CSV report) | `node server/scripts/audit.js` |

## Testing

The authentication integration tests use `MongoMemoryServer` when `MONGO_TEST_URI` is unset. When `MONGO_TEST_URI` is set, they connect to that database instead. Before each test, the suite calls `mongoose.connection.dropDatabase()`, which deletes every collection in the connected test database. Never point it at a production, shared, or otherwise valuable database. Confirm the effective test URI is a separate disposable database before running `npm test --prefix server`.

The initial-admin command requires explicit client approval and a verified production environment; it creates an admin only if none exists, never replaces an account, and sends email verification. See the [admin guide](./handover/Admin-User-Guide.md).

The Node utility tests do not connect to MongoDB and can be run independently with the command above. There is no separate client test script currently configured.

## Production Build And Deployment

Build the client and run the server from the project root:

```powershell
npm run build --prefix client
npm start --prefix server
```

The Express application serves `client/dist` when the build exists. Unknown API endpoints return JSON 404 responses; client-side routes are served by the frontend fallback.

The existing [render.yaml](render.yaml) describes a Render Node web service that installs both packages, builds the client, starts the server, and checks `/api/health`. For a deployment based on this Blueprint:

1. Create a MongoDB Atlas database and a restricted database user.
2. Configure all production variables listed above in the hosting provider's secret settings. Render generates the three authentication secrets in the Blueprint; verify the generated values meet the application's minimum length.
3. Use the exact deployed HTTPS origin for `CLIENT_URL` and `ALLOWED_ORIGINS`.
4. Configure a real SMTP provider and sender address before enabling account verification or recovery workflows.
5. Provision an admin account through an authorized, access-controlled process. Public admin registration is disabled.
6. Seed catalogue data only against a confirmed fresh database; do not use `--force` against production data.
7. After deployment, verify `/api/health`, registration/email flows, student access, and authorized admin workflows.

The Render configuration is provided as project configuration, not as authorization to change production infrastructure. Confirm service plan, domain, database, backups, and access controls with the client before deployment. A private GitHub repository does not make a deployed website private.

## Security Considerations

- Keep `.env` files, database credentials, SMTP credentials, secrets, and recovery codes out of Git and issue trackers.
- Use unique production secrets, each at least 32 characters, and rotate them through the hosting provider if exposed.
- Restrict `ALLOWED_ORIGINS` to trusted origins and use HTTPS in production.
- Authentication uses HttpOnly SameSite cookies, CSRF checks for authenticated mutations, password hashing with Argon2id, hashed reset tokens, and rate limiting.
- The built-in rate limiter is in-memory. Multi-instance deployments should use a shared rate-limit store.
- Review dependency advisories and update dependencies through a tested, reviewed change; do not apply blanket audit fixes to production without compatibility checks.
- Treat test and seed commands as potentially destructive to the database selected by their environment.

## Troubleshooting

- **API cannot connect to MongoDB:** confirm MongoDB is running and `MONGO_URI` points to the intended development database.
- **Frontend API requests fail:** start the API and verify `VITE_API_PROXY` matches its origin; restart Vite after changing environment files.
- **Verification or recovery emails do not arrive:** configure valid SMTP settings and a deliverable `MAIL_FROM`; check provider logs and spam filtering.
- **Production startup rejects configuration:** verify `NODE_ENV=production`, the three distinct 32-character secrets, `CLIENT_URL`, `ALLOWED_ORIGINS`, and required SMTP variables are set in the host.
- **Authentication cookies fail behind a proxy:** serve over HTTPS and confirm the hosting proxy configuration and cookie domain match the public site.
- **Integration tests target the wrong database:** stop before running them; verify `MONGO_TEST_URI` without printing its value and ensure it names a dedicated disposable database.

## Client Handover

- Deliver repository access privately and transfer production credentials through an approved secret manager or secure channel, never through Git.
- Provide the client with ownership of the hosting, domain, MongoDB, and SMTP accounts, plus recovery and billing contacts.
- Record the approved production environment-variable names, not their secret values, and document who can rotate them.
- Confirm database backup and restore procedures, admin-account provisioning, and the operational owner for catalogue updates.
- Verify the live public site and restricted admin access with the client before handover. Review data quality and official links regularly because admission and scholarship dates change.

## Administration And Data Maintenance

There are no default admin credentials in the project. Admin/editor accounts are not created through public registration. An authorized administrator should provision the account through a trusted process and share initial credentials privately. Admins can request a password reset by email or change their password while signed in; password changes sign the admin out.

Use the Admin dashboard to maintain university deadlines, programs, scholarships, and announcements. Verify dates and eligibility against official sources, mark expired scholarship calls closed, and use unpublished announcements for drafts. The student portal supports account verification, shortlists, and application checklists.

Student authentication endpoints include registration, login, verification, recovery, reset, refresh, and logout under `/api/auth`. Student shortlist and checklist endpoints are scoped to the authenticated user. Recovery responses do not disclose whether an account exists; reset links are single-use and expire. Do not include real user information or credentials in issue reports or handover documents.
