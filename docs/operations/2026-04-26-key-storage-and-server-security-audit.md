# 2026-04-26 Key Storage and Server Security Audit

## Scope

- Document where Dorami address-encryption keys are currently stored
- Record the 2026-04-26 staging/prod address-encryption backfill status
- Audit prod/staging servers for unnecessary files and security-relevant leftovers

## Current encryption-key storage

### GitHub Actions Secrets

The current deployment path depends on GitHub repository secrets.

**Production**

- `PROD_PROFILE_ENCRYPTION_KEY`
- `PROD_PROFILE_LEGACY_ENCRYPTION_KEYS`

**Staging**

- `STAGING_PROFILE_ENCRYPTION_KEY`
- `STAGING_PROFILE_LEGACY_ENCRYPTION_KEYS`

### Runtime environment

The running backend containers also hold the keys in process environment variables.

**Production runtime**

- `PROFILE_ENCRYPTION_KEY`
- `PROFILE_LEGACY_ENCRYPTION_KEYS`

**Staging runtime**

- `PROFILE_ENCRYPTION_KEY`
- `PROFILE_LEGACY_ENCRYPTION_KEYS`

## Risk assessment for key storage

Current state is recoverable, but not ideal.

### Good

- Keys are present in both deployment secrets and running runtime env
- Legacy key bundle is preserved, so older payloads remain decryptable
- Staging was aligned with production legacy-key handling on 2026-04-26

### Remaining risk

- GitHub Secrets are still the main durable source of truth
- Running container env is not durable backup; instance loss or redeploy mistakes can remove easy access
- There is no separate dedicated secret manager currently documented as the canonical source of truth
- There is no documented offline escrow/backup record for recovery if repo secrets are deleted

## Recommended final key-storage policy

1. **Canonical source of truth:** move current + legacy key bundle into AWS Secrets Manager or SSM Parameter Store
2. **Deployment copy:** continue mirroring into GitHub Secrets for Actions-based deploys
3. **Emergency backup:** store the same bundle in an operator-controlled encrypted vault (for example 1Password/Bitwarden secure note)
4. **Versioning:** keep `current` + `legacy` together and document key rotation dates
5. **Recovery drill:** periodically verify that old payloads still decrypt using only the documented backup sources

## Address-encryption rollout status (2026-04-26)

### Staging

**Users**

- envelope: `395`
- plain object: `0`
- legacy string: `0`

**Orders**

- envelope: `129`
- legacy string: `0`
- empty payload rows: `5`

### Production

**Users**

- envelope: `510`
- plain object: `0`
- legacy string: `0`

**Orders**

- envelope: `888`
- legacy string: `0`
- empty payload rows: `12`

### Interpretation

- All rows containing real address data are now encrypted as JSON envelopes
- Remaining non-encrypted order rows are empty payloads, not real customer addresses
- Backfill apply failures on both staging and production were `0`

## Server audit findings

### Production (`dorami-prod`)

#### High severity

1. **Private-key artifact still present in server checkouts**
   - `/opt/dorami/dorami-prod-key.zip`
   - `/home/ubuntu/dorami/dorami-prod-key.zip`
   - Risk: old key artifact still sitting on disk; even if revoked, it is unnecessary sensitive material

2. **Decryption helper script containing real encryption keys still present**
   - `/opt/dorami/test-decrypt.js`
   - The script contains hardcoded key material including the current prod encryption key and older keys
   - Risk: anyone with file read access can recover current/legacy keys directly from the script

#### Medium severity

3. **Orphaned env backup file in old checkout**
   - `/home/ubuntu/dorami/backend/.env.orphaned.bak`
   - Contains sensitive variable names and likely secret values
   - Risk: stale backup with secrets that is outside the active deploy path

4. **Duplicate stale checkout under `/home/ubuntu/dorami`**
   - Active deploy path is `/opt/dorami`, but `/home/ubuntu/dorami` still exists with env files, backups, and artifacts
   - Risk: stale duplicate source trees accumulate secrets and confuse operators during incidents

5. **Prod worktree is dirty and contains local-only files**
   - `/opt/dorami` showed modified files and `.backups/`
   - Risk: on-server checkout is no longer a clean source mirror; more chance of operator confusion and accidental secret persistence

#### Lower severity / informational

6. **`client-app/.env.local` present in old checkout**
   - `/home/ubuntu/dorami/client-app/.env.local`
   - Contains local frontend environment config names
   - Less severe than backend secret files, but still unnecessary in a server checkout

### Staging (`dorami-staging-hermes`)

#### High severity

1. **Private-key artifact still present**
   - `/home/ubuntu/dorami/dorami-prod-key.zip`
   - Risk: same as prod; unnecessary sensitive artifact on disk

2. **Decryption helper script containing key material still present**
   - `/home/ubuntu/dorami/test-decrypt.js`
   - `/opt/dorami/test-decrypt.js`
   - Risk: exposes current/legacy encryption keys to anyone with file access

3. **TLS private key permissions are too open**
   - `/opt/dorami/nginx/ssl/privkey.pem`
   - Observed permission: `644`
   - Risk: world-readable private key on the server filesystem; should be restricted to root-only or service-owner-only access

#### Medium severity

4. **Stale env backup still present**
   - `/opt/dorami/.env.staging.bak`
   - Contains many operational env keys including encryption-related settings
   - Risk: unnecessary duplicate secret-bearing file

5. **Backup/old config files left in active tree**
   - `/opt/dorami/docker-compose.staging.yml.backup`
   - `/opt/dorami/nginx/production.conf.backup`
   - `/opt/dorami/nginx/production.conf.old`
   - Risk: not automatically critical, but these expand attack surface and increase operator confusion

## Recommended cleanup order

### Priority 1 — remove secret-bearing leftovers

- `dorami-prod-key.zip` from all prod/staging checkouts
- `test-decrypt.js` from all prod/staging checkouts
- `backend/.env.orphaned.bak` on prod
- `.env.staging.bak` on staging

### Priority 2 — fix file permissions

- tighten `/opt/dorami/nginx/ssl/privkey.pem` on staging to `600` (or stricter with correct owner)
- audit any other TLS private keys/certs for the same issue

### Priority 3 — reduce stale duplication

- decide whether `/home/ubuntu/dorami` is still needed on prod/staging
- if not needed, archive or remove it after confirming no deploy path uses it
- keep `/opt/dorami` as the only server checkout for inspections

### Priority 4 — operational hygiene

- keep server worktrees clean, or clearly separate backups from source checkouts
- avoid leaving ad-hoc decrypt/test scripts on servers after incident/debug work
- document a server-side “allowed persistent artifacts” policy for env files, compose files, and backups

## Notes on boundaries

- This audit intentionally used the servers for inspection only
- No destructive cleanup was performed during this pass
- Recommended removals should be done deliberately, ideally after a quick ownership/use-path confirmation

## Related PRs / commits

- PR `#86` — address backfill tooling + staging legacy-key wiring
- merge commit: `3d07b22`
