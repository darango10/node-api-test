# Gitflow & Deployment Strategy

This document defines the branching model and deployment rules to **minimize risk of breaking production**. All changes must pass CI before reaching production.

---

## 0. How many environments? (Dev + Prod vs Dev + Staging + Prod)

| Option | Environments | When it's enough | When to add the third |
|--------|----------------|-------------------|------------------------|
| **2 environments** | **Dev** + **Prod** | Small/medium teams, API or app with good test coverage and CI. You merge to `main` only after review + green CI. | — |
| **3 environments** | **Dev** + **Staging** + **Prod** | When you need a **production-like** place to test integrations, UAT, or manual QA before releasing (e.g. third-party APIs, payments, complex flows). | Add **Staging** when "we need to see it working like prod before we release." |

**Recommendation for most cases:** Start with **Dev + Prod**. Add **Staging** only if you have a real need (QA, UAT, integration tests against prod-like data, compliance, or many people touching the same release). Staging adds cost (infra, config, drift) and an extra step before production; use it when the benefit is clear.

- **Dev:** where developers and CI run (local + branches + optionally `develop`).
- **Prod:** only from `main`; deploy only after PR + CI (and optional approval).
- **Staging (optional):** deploy from `develop` (or a release branch); use for "last check before prod."

---

## 1. Branch Strategy

| Branch | Purpose | Deploys to | Protection |
|--------|---------|------------|------------|
| **`main`** | Production-ready code. Single source of truth for live. | **Production** | Protected, requires PR + CI pass |
| **`develop`** | Integration branch. All features merge here first. | **Staging** (optional) | Protected, requires PR + CI pass |
| **`feature/*`** | New functionality (e.g. `feature/order-cancel`) | — | Short-lived, merge into `develop` |
| **`hotfix/*`** | Urgent production fixes (e.g. `hotfix/fix-auth`) | — | Branch from `main`, merge back to `main` and `develop` |
| **`release/*`** | Optional: release prep (version bump, changelog) | — | Branch from `develop`, merge to `main` and `develop` |

### Flow diagram

```
feature/* ──PR──► develop ──PR──► main
    │                  │              │
    │                  ▼              ▼
    │            [Staging]      [Production]
    │
hotfix/* ──PR──► main ──► (then merge main → develop)
```

### How many PRs to reach production?

| Path | PRs | Typical use |
|------|-----|-------------|
| **feature → develop** then **develop → main** | **2 PRs** | Default: integrate in `develop`, then promote a batch to production. |
| **feature → main** (no develop) | **1 PR** | Truly minimal: one PR per feature/fix; good for small teams and simple flows. |
| **hotfix → main** | **1 PR** | Urgent fix; then sync `main` back into `develop` (or your integration branch). |

**Recommendation:** Use **2 PRs** (feature → develop, develop → main) when you have an integration branch and want a clear “staging” step in code flow. Use **1 PR** (feature → main) if you have no `develop` and deploy every merge to `main` that passes CI. In both cases, **production is only updated from `main`**, and every merge to `main` must be via PR with CI green.

**Rule:** Nothing goes to `main` without a **Pull Request** and **passing CI**. Direct pushes to `main` must be blocked.

---

## 2. GitHub Branch Protection (Recommended)

Configure in **Settings → Branches → Branch protection rules** for `main` (and optionally `develop`).

### For `main` (mandatory)

| Setting | Value | Reason |
|---------|--------|--------|
| **Require a pull request before merging** | Yes | No direct pushes |
| **Require status checks to pass** | Yes | CI must pass |
| **Required status checks** | `Lint & Test`, `Docker build & scan` (exact job names from CI workflow) | Fail fast on lint/test/security |
| **Require branches to be up to date** | Yes | Avoid merging stale code |
| **Do not allow bypassing** | Recommended | Enforce for everyone including admins |
| **Restrict who can push** | Optional: only release managers / automation | Extra safety |

### For `develop` (recommended)

- Require PR + status checks. Optionally allow direct push for minor fixes (team decision).

---

## 3. CI/CD Pipeline (Fail-Fast)

Current pipeline behavior (see `.github/workflows/ci.yml` and `docker-push.yml`):

1. **On every push / PR** to `main` or `develop` (and from feature branches when opening PRs):
   - **Lint** (ESLint) + **Format** (Prettier)
   - **Tests** (Vitest) with coverage thresholds (80%)
   - **Dockerfile lint** (Hadolint)
   - **Docker build** + **Trivy** (CRITICAL/HIGH → fail)

2. **After CI succeeds on `main`**:
   - **Docker push** to GHCR with tags: `sha-xxx`, `latest`.

**Principle:** If CI fails, the branch cannot be merged (when status checks are required), and no production image is built from that commit.

---

## 4. Deployment Rules (No Breaking Production)

| Environment | Trigger | Image tag | Rule |
|-------------|---------|-----------|------|
| **Staging** | Merge to `develop` (optional) | e.g. `staging` or `sha-xxx` | Test full flow before promoting to main |
| **Production** | Merge to `main` (or tag `v*`) | `latest` + `sha-xxx` | Only deploy from `main`. No deploy from feature/hotfix branches directly |

- **Deploy production only from `main`.**  
  Your CD (GitHub Actions, Argo CD, Terraform, or external system) should use the image built from the **commit on `main`** (e.g. `ghcr.io/owner/repo:latest` or `ghcr.io/owner/repo:<sha>`).
- **Prefer immutable tags in production:** e.g. deploy by digest or `sha-xxx` instead of `latest` so rollbacks are deterministic.

---

## 5. Rollback Strategy

If production breaks after a deploy:

1. **Immediate:** Redeploy the **previous known-good image** (by tag or digest).  
   - Keep a log of “last deployed digest/tag” (e.g. in your CD or a release log).  
   - Do not fix forward only; roll back first to restore availability.

2. **Code rollback (if needed):**
   - **Option A:** Revert the merge commit on `main` (e.g. `git revert -m 1 <merge_commit>`), push, let CI run and redeploy from new `main`.
   - **Option B:** Open a **hotfix** from the last good tag, fix the bug, merge via PR to `main`, then deploy.

3. **Database / breaking changes:**  
   - Prefer **backward-compatible** migrations and API changes.  
   - If a deploy includes a breaking change, coordinate rollback of app and migrations (document in runbooks).

---

## 6. Checklist Before Merging to `main`

- [ ] PR targets `main` (from `develop` or `hotfix/*`).
- [ ] CI is green (lint, tests, Docker build, Trivy).
- [ ] Code review approved (if required).
- [ ] No known critical/high vulnerabilities in the image.
- [ ] Changelog/release notes updated (if your process requires it).

---

## 7. Summary

| Goal | How |
|------|-----|
| **Don’t break production** | Deploy only from `main`; require PR + CI for `main`. |
| **Catch errors early** | CI on every PR (lint → test → Docker → security). |
| **Safe rollback** | Deploy by immutable tag/digest; revert or hotfix if needed. |
| **Clear ownership** | Branch protection and optional restrict push to `main`. |

This gitflow keeps production stable by ensuring only tested, reviewed code reaches `main` and only that code is deployed to production.
