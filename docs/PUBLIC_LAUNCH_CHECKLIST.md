# Public launch checklist

Status reflects the repository audit and this launch PR. “Remaining follow-up” items are intentionally outside this documentation-focused change.

| Area | Status | Evidence or follow-up |
| --- | --- | --- |
| README first-screen explanation and quick start | Fixed in this PR | Rewritten for requirement-aware review, offline fixtures, release status, and limitations. |
| Offline onboarding | Fixed in this PR | Fresh-clone command sequence and fixture workflow documented. |
| Contributor onboarding | Fixed in this PR | `CONTRIBUTING.md` covers structure, cases, adapters, tests, PRs, and integrity. |
| Code of conduct | Fixed in this PR | Contributor Covenant 2.1 attribution added. |
| Security reporting | Fixed in this PR | Private GitHub reporting, key revocation, and scope guidance added. |
| Issue intake | Fixed in this PR | Bug, case, contributed-run, and methodology templates added. |
| Pull-request intake | Fixed in this PR | Focus, test, secret, artifact, and methodological checkboxes added. |
| Contributed runs | Fixed in this PR | Acceptance rules and machine-readable manifest added. |
| Roadmap | Fixed in this PR | Current/Next/Later scope replaces stale v0.1 planning in `ROADMAP.md`. |
| Citation guidance | Fixed in this PR | Valid `CITATION.cff` added; no DOI invented. |
| Release visibility | Fixed in this PR | README links v0.3.1-beta, changelog, smoke-test docs, and limitations. |
| Repository description/topics | Fixed in this PR | Repository description and launch topics were applied through GitHub settings; exact values are recorded in the PR description. |
| GitHub Discussions | Complete | Enabled for the repository; the issue-template contact link is active. |
| Private vulnerability reporting | Complete | Enabled for the repository; the issue-template and security links are active. |
| CI avoids live calls | Complete | `.github/workflows/ci.yml` runs install, typecheck, validate, and tests only. |
| Apache-2.0 license | Complete | Existing `LICENSE` is the full Apache-2.0 text. |
| Current-tree secret hygiene | Complete | `.env*` ignored, `.env.example` contains placeholders only, and no credential material was added. |
| History secret scan | Complete | Searched tracked history for key/token/header patterns without printing matches. |
| Generated/report artifacts | Complete | Existing committed artifacts are retained and described as preliminary; no result values changed. |
| Third-party notices | Remaining follow-up | No additional notice was required by this PR; revisit if copied assets or code are added later. |
| Independent case review | Remaining follow-up | Planned in `ROADMAP.md`. |
| First outside full contributed run | Remaining follow-up | Planned in `ROADMAP.md`; no paid run was made for this PR. |
| Human adjudication | Remaining follow-up | Current release keeps automatic and adjudicated metrics separate. |
