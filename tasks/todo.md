# VPS & GitHub Actions Configuration Plan

## 1. Initial VPS Inspection
- [x] Connect to VPS (`administrator@155.117.45.192`) and test permissions.
- [x] Inspect existing Nginx configuration for `usa-app` to ensure no conflict.

## 2. Nginx Configuration for negociator.site
- [x] Create directory structure `/var/www/negociator.site/html`.
- [x] Create Nginx server block (`/etc/nginx/sites-available/negociator.site`).
- [x] Enable site and test Nginx configuration (`nginx -t`).
- [x] Reload Nginx to apply changes.

## 3. GitHub Actions Setup
- [x] Create SSH key pair on VPS for GitHub Actions deploy.
- [x] Add Deploy Key to VPS `authorized_keys`.
- [x] Provide instructions to user for adding GitHub Secrets (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`).
- [x] Create `.github/workflows/deploy.yml` locally for robust automated deployment.
- [ ] Verify deployment via GitHub push.
