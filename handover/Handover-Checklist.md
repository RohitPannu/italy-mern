# Client handover checklist

Complete and record each item with the client. Do not put credentials in this checklist.

## Delivery status

- [ ] Live website URL: pending deployment.
- [ ] Admin login URL: `https://<client-domain>/admin` (confirm after domain setup).
- [ ] Private source repository URL: pending client-approved repository creation and upload.
- [ ] Hosting provider: Render; service ownership and plan to be confirmed in the client account.
- [ ] Database provider: MongoDB Atlas (recommended); client project/cluster ownership to be confirmed.
- [ ] Production smoke tests: pending deployment and client-authorized test accounts.
- [x] Project README and handover guides prepared in `handover/`.

## Client-controlled accounts

- [ ] Client owns the domain registrar and DNS records.
- [ ] Client owns the Render account, web service, billing settings, and deployment access.
- [ ] Client owns the MongoDB organization/project, production cluster, database user, backups, and billing settings.
- [ ] Client owns the private source repository and controls its organization access.
- [ ] Client controls the SMTP provider and verified sender address.
- [ ] Client appoints and securely provisions an initial administrator account.
- [ ] Two client-controlled owners/admins are identified for account recovery where supported.

## Security and operations

- [ ] Production secrets are generated and stored only in Render's secret settings or an approved password manager.
- [ ] Production database credentials use least privilege and restricted network access.
- [ ] Backup schedule and restore contact are documented in the client's own secure operations system.
- [ ] Domain HTTPS, canonical host, and redirect behavior are verified after DNS propagation.
- [ ] Client receives admin training and a private credential-delivery method.
- [ ] Support agreement, response expectations, and maintenance responsibility are agreed separately.

## Ownership transfer

Create provider accounts in the client's name from the start whenever possible, then invite the developer with the minimum access needed. If a service is currently under a developer's personal account, transfer ownership using the provider's official process only after confirming the client's access, billing, recovery email, MFA, backups, and successful service operation. Do not transfer or revoke access without written client approval and a recovery plan.
