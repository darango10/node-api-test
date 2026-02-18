# Branch Protection Setup (GitHub)

Configure these rules so production (`main`) cannot be broken by direct pushes or untested code.

---

## Via GitHub Web UI

1. Repo **Settings** → **Branches** → **Add branch protection rule** (or edit rule for `main`).
2. **Branch name pattern:** `main` (or `master` if that is your default).

### Recommended settings for `main`

| Setting | Value |
|--------|--------|
| **Require a pull request before merging** | ✅ |
| **Required approvals** | 1 (or 0 if only CI is enough) |
| **Dismiss stale pull request approvals when new commits are pushed** | ✅ |
| **Require status checks to pass before merging** | ✅ |
| **Require branches to be up to date before merging** | ✅ |
| **Status checks that are required** | Add: `Lint & Test`, `Docker build & scan` (exact names from [CI workflow](../.github/workflows/ci.yml)) |
| **Require conversation resolution before merging** | Optional ✅ |
| **Do not allow bypassing the above settings** | ✅ (recommended) |
| **Restrict who can push to matching branches** | Optional: leave empty or add only release managers |

3. **Save changes.**

---

## Status check names (from this repo's CI)

Use these **exact** names in "Require status checks to pass":

- `Lint & Test`
- `Docker build & scan`

If you rename jobs in `.github/workflows/ci.yml`, update the branch protection rule accordingly.

---

## Optional: protect `develop`

- Branch name pattern: `develop`
- Same idea: require PR + status checks if you want every merge to develop to be tested.

---

## Via GitHub API (automation)

Example: require PR and status checks for `main` (replace `OWNER` and `REPO`):

```bash
# Requires a fine-grained or classic PAT with repo admin rights
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["Lint & Test", "Docker build & scan"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": { "required_approving_review_count": 1 },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

---

After this, no one can merge into `main` until CI passes, reducing the risk of breaking production.
