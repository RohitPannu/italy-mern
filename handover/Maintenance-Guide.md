# Maintenance guide

## Backups and database care

- Keep the MongoDB project, cluster, and backups under the client's ownership.
- Enable and periodically test the client's approved automated backup/snapshot policy.
- Before a schema or data change, capture a backup and confirm a tested restore path.
- Never run `npm run seed --prefix server` on an existing production database without a verified backup and explicit client approval. The seed script replaces catalogue collections.
- Mongoose schemas define indexes; review planned index changes and database impact before rollout. There is no migration framework in this repository.

## Application updates

1. Review and test source changes in a non-production environment.
2. Keep lockfiles in sync with intentional dependency changes; do not upgrade dependencies as part of routine deployment without review.
3. Review the diff for `.env` files, credentials, generated output, and database dumps before publishing.
4. Back up the database before data-affecting releases.
5. Deploy through the client's approved private repository and Render service, then run the smoke checklist.

## Monitoring

Monitor the Render service health endpoint (`/api/health`), service availability, startup and request error rates, MongoDB availability, SMTP delivery, and provider usage limits. Review logs in the provider dashboard, but redact credentials and personal information before sharing diagnostic excerpts.

## Incident response

If a credential is exposed, revoke or rotate it in the owning provider immediately and update the Render environment. If an account is compromised, disable/revoke access using the approved procedure, preserve relevant audit evidence, and inform the client owner. Do not place incident secrets or personal data in Git or this guide.

## Common troubleshooting

- **Startup fails:** check required Render environment variable presence (not values in shared tickets), MongoDB network access, and service logs.
- **API returns 500:** check service and database health and correlate the request time; do not disclose tokens or user records.
- **Email problems:** verify SMTP configuration and sender authorization in the provider account.
- **Catalogue is absent:** confirm the intended database was initialized. Do not rerun the seed script without backup and authorization.
- **Browser auth/CORS failures:** verify HTTPS, allowed origins, proxy trust, and host-only cookie behavior; do not weaken cookie or CSRF protections.
