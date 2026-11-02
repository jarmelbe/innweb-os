# InnWeb — GitHub security checklist (administrative actions)

This repository stores software source, **not** customer data, passwords, or production credentials.
The existence of this checklist does not certify the repository or deployment as secure.

## Account access (owner must do these in GitHub)

- Enable 2FA/passkeys in GitHub Settings → Password and authentication on **both** InnWeb-related accounts that have repository access.
- Save recovery codes in a secure password manager; never commit them.
- Review GitHub Settings → Applications: revoke unused OAuth apps and GitHub App installations.
- Review personal access tokens and SSH keys; revoke unused credentials. Use fine-grained, short-lived tokens.
- Review repository collaborators; remove permissions that are no longer needed.

## Repository settings (owner/admin must do these)

- Review Settings → General → repository visibility. Changing from public to private may affect Pages, forks, security scanning, and existing integrations; **check the Vercel deployment before making this change**.
- Settings → Branches or Rules → Rulesets: protect `main`, disallow force-pushes and deletions, require passing CI checks, require PRs where workable, and restrict bypasses.
- For a solo-maintainer repository, do not enforce mandatory peer approval unless an independent reviewer exists, or the owner may be blocked. Enforce CI first.
- Settings → Security & analysis: enable Dependabot alerts and security updates, secret scanning and push protection when available for the account/repository plan.
- Settings → Actions → General: grant default workflow token read-only permissions, only permit necessary actions, and avoid giving secrets to PRs from forks.
- Settings → Environments: require review before production deployments when available.

## Deployment secrets

- Store production DATABASE_URL, DIRECT_URL, setup tokens and API keys in the deployment provider's encrypted environment configuration, not in GitHub files.
- Rotate keys after suspected exposure; making a repository private is **not** sufficient for previously leaked credentials.
- Avoid performing database migrations inside unreviewed builds. Review migration effects on actual deployment workflow before modifying it.
- Confirm that preview deployments cannot reach production data with broad write permissions.
- Use isolated dev/preview data stores, and test backups/restores before handling real customer data.

## Change control

- Develop in feature/security branches; review changes before merging.
- Inspect Dependabot PRs and lockfile diffs before merging or enabling auto-merge.
- Ensure CI succeeds before release. A passing dependency audit does not imply that application authorization is secure.

Last reviewed: 2026-11-02. This document lists recommended controls, not verified settings.
