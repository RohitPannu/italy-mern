# Admin user guide

## Admin sign-in

The admin portal is at `/admin` on the deployed website (for example, `https://<client-domain>/admin`). Use only an account that the client has explicitly provisioned with the `admin` role. This repository does not provide public admin registration or a documented admin bootstrap command. Ordinary public registration creates student accounts and must not be used to create an administrator.

Use the password manager or another client-approved secure channel to deliver credentials. Require the admin to set a unique password and verify their email. Password recovery requires the configured production email service.

## Managing content

The protected dashboard supports the existing content workflows for universities, programs, scholarship calls, announcements, and CSV imports. Sign in, choose the relevant dashboard section, review changes carefully, and verify public pages after saving. Only publish information that the client has verified against official sources.

CSV import templates are in `server/data/*-template.csv`. Keep the template headers unchanged, validate rows and source URLs before import, and export or back up current catalogue records before any replacement/import operation. The import interface may support replacement; do not select a replace operation unless the client has approved it and a current backup exists.

## Users and access

Student and staff access is role-protected. Grant administrative access only through the client-approved provisioning procedure. Remove access promptly when a staff member leaves, and never share an administrator account. Do not send passwords, reset tokens, or session cookies in email or support messages.

## Support and recovery

For a locked-out or compromised account, contact the client account owner through an approved private channel. Rotate affected credentials and invalidate sessions using the approved operational procedure. Do not edit production records directly without a backup and explicit client authorization.
