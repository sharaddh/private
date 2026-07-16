# Release Checklist

> **Purpose:** Comprehensive checklist for managing software releases from feature freeze through post-release monitoring. Covers testing, documentation, versioning, deployment, and communication.
> **AI Instructions:** Use this checklist for every release, whether major, minor, or patch. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed. Major releases may require additional steps not listed here.

---

## Feature Freeze Checklist

- [ ] **Feature freeze date is communicated** — All team members know when new feature development stops and the release process begins. Date is on the team calendar.
- [ ] **Release branch is created** — A release branch (e.g., `release/v2.5.0`) is created from main/develop. Only bug fixes go into this branch going forward.
- [ ] **Feature flags are reviewed** — All feature flags targeting this release are identified. Decide which to enable, which to keep disabled, and which to remove.
- [ ] **Incomplete features are deferred** — Features not ready for release are explicitly moved to the next release. No "almost done" features sneak in.
- [ ] **Dependency updates are paused** — No new dependency versions are pulled into the release branch. Pin all dependencies. Only security patches after freeze.
- [ ] **Known issues are documented** — Any known bugs or limitations in this release are documented with workarounds. This list is reviewed before release approval.
- [ ] **Tech debt items are triaged** — Quick-fix tech debt items may be included. Larger refactors are explicitly deferred. Don't introduce new tech debt in a release.
- [ ] **Branch protection is enforced** — Release branch has protection rules: no force pushes, required reviews, CI checks must pass. Prevents accidental changes.
- [ ] **Code freeze is enforced technically** — If possible, use branch protection or CI rules to enforce the freeze. Relying on discipline alone is fragile.

### Common Mistakes
- Not defining a clear freeze date (leads to scope creep)
- Allowing "just one more feature" after freeze
- Not documenting deferred features (they get forgotten)
- Merging unrelated changes into the release branch

---

## Testing Checklist

- [ ] **Full test suite passes** — All unit, integration, and E2E tests pass on the release branch. No skipped or disabled tests without a tracked issue.
- [ ] **Manual testing of critical paths** — QA (or the team) manually tests the most important user flows: registration, login, core functionality, payment, and logout.
- [ ] **Regression testing is performed** — Run regression test suite against the release branch. Focus on areas with recent changes and known fragile areas.
- [ ] **Cross-browser testing is done** — Verify the application works in all supported browsers (Chrome, Firefox, Safari, Edge). Mobile browsers included.
- [ ] **Performance testing is acceptable** — Response times, page load times, and resource usage are within acceptable thresholds. No performance regressions.
- [ ] **Security testing is complete** — Run SAST/DAST tools. Review any new security findings. No critical or high-severity findings remain open.
- [ ] **Accessibility testing passes** — Run automated accessibility tests. Manual spot-check with screen reader on key pages.
- [ ] **Load testing confirms capacity** — If expecting traffic spike (launch, marketing campaign), verify the system handles expected load.
- [ ] **API contract tests pass** — Verify all API contracts match documentation. Consumer-driven contract tests (Pact) pass.
- [ ] **Database migration tests pass** — Migrations run cleanly up and down on a production-like dataset. Rollback is tested.
- [ ] **Edge cases are tested** — Empty states, error states, boundary values, concurrent users, and offline scenarios are verified.
- [ ] **Test results are documented** — Record what was tested, what passed, what failed, and any workarounds applied. This becomes part of the release record.

### Common Mistakes
- Relying solely on automated tests (manual testing catches UX issues)
- Not testing the actual release artifact (test against the built artifact, not dev builds)
- Skipping performance testing because "it was fine last time"
- Not testing rollback procedures

---

## Documentation Checklist

- [ ] **User-facing documentation is updated** — Help center articles, user guides, and tutorials reflect the changes in this release.
- [ ] **API documentation is current** — OpenAPI/Swagger spec is updated with new endpoints, changed parameters, and deprecated features. Request/response examples are correct.
- [ ] **Release notes are drafted** — Release notes include: new features, bug fixes, breaking changes, deprecations, and known issues. Written for the audience (users vs developers).
- [ ] **Breaking changes are highlighted** — Any breaking changes have clear migration guides. Old behavior → new behavior is explained with code examples.
- [ ] **Deprecation notices are issued** — Deprecated features have advance notice. Deprecation timeline is documented. Alternative approaches are recommended.
- [ ] **Internal documentation is updated** — Architecture docs, runbooks, and operational guides reflect changes. New failure modes are documented.
- [ ] **Changelog is complete** — CHANGELOG.md includes all user-facing changes since the last release. Follows Keep a Changelog format.
- [ ] **README is current** — Setup instructions, feature descriptions, and screenshots reflect the current state.
- [ ] **Onboarding materials are updated** — If the release changes the user experience, onboarding flows and tutorials are updated.

### Common Mistakes
- Writing release notes at the last minute (miss important changes)
- Not documenting breaking changes clearly (leads to support tickets)
- Forgetting to update API docs (leads to integration failures)
- User-facing docs written for developers (wrong audience)

---

## Changelog Checklist

- [ ] **Changelog follows a standard format** — Use [Keep a Changelog](https://keepachangelog.com/) format with Added, Changed, Deprecated, Removed, Fixed, and Security sections.
- [ ] **All user-facing changes are included** — Every change that affects users is documented. Internal refactors that don't change behavior are not included.
- [ ] **Entries are clear and actionable** — Each entry explains what changed and why. Users understand the impact without reading source code.
  ```markdown
  ## [2.5.0] - 2024-12-15

  ### Added
  - Bulk import feature for CSV files. See [documentation](link) for format requirements.
  - Dark mode support across all pages. Toggle in Settings > Appearance.

  ### Changed
  - Dashboard now loads data progressively instead of all at once. First paint is 40% faster.
  - Password requirements updated: minimum 12 characters (was 8). Existing passwords are not affected until next change.

  ### Deprecated
  - The `/api/v1/legacy-export` endpoint. Use `/api/v2/export` instead. Removal planned for v3.0.0.

  ### Fixed
  - Fixed issue where large CSV imports (>10MB) would time out. Maximum file size is now 50MB.
  - Fixed date formatting inconsistency on the Reports page.

  ### Security
  - Updated `axios` from 1.6.0 to 1.6.5 to address CVE-2024-XXXX.
  ```
- [ ] **Version number follows semver** — Major for breaking changes, minor for new features, patch for bug fixes. Version is unambiguous.
- [ ] **Links are provided where helpful** — Link to documentation, migration guides, and related issues.
- [ ] **Changelog is reviewed by the team** — At least one other team member reviews the changelog for accuracy and completeness.
- [ ] **Changelog is published before or with the release** — Users shouldn't have to dig for what changed. Changelog is prominently linked.

### Common Mistakes
- Using vague entries like "bug fixes" or "various improvements"
- Not following semver (makes dependency management painful)
- Forgetting deprecated or removed features
- Writing changelog entries in developer jargon

---

## Version Bump Checklist

- [ ] **Version number is determined** — Based on semver rules and the nature of changes:
  - **Major (X.0.0):** Breaking changes, major new features, significant architecture changes
  - **Minor (0.X.0):** New features, non-breaking changes, new deprecations
  - **Patch (0.0.X):** Bug fixes, security patches, documentation updates
- [ ] **Version is updated in all relevant files** — package.json, pyproject.toml, Cargo.toml, version.h, build.gradle, or equivalent files are updated.
- [ ] **Git tag is created** — A tag matching the version (e.g., `v2.5.0`) is created on the release commit. Tag is annotated with release notes.
- [ ] **Version is embedded in the build artifact** — The version number is accessible in the running application (e.g., `/health` endpoint response, footer of web app).
- [ ] **Docker image is tagged correctly** — Image is tagged with both the version number and `latest` (only if it's the latest stable release).
  ```
  docker tag myapp:abc123 myapp:2.5.0
  docker tag myapp:abc123 myapp:latest
  ```
- [ ] **Dependency versions are pinned** — If releasing a library, peer dependencies and version ranges are correctly specified.
- [ ] **Version history is clean** — No version number is reused. If a release is yanked, the next version continues the sequence.

### Common Mistakes
- Forgetting to update the version in one of multiple files
- Not creating a git tag (makes rollback and identification harder)
- Using `latest` as the only tag (can't roll back to a specific version)
- Releasing a major version bump with only minor changes (wastes the breaking change budget)

---

## Deployment Checklist

See `deployment.md` for the full deployment checklist. Key items for release deployments:

- [ ] **Deployment plan is documented** — Step-by-step deployment process for this specific release. Includes timing, responsible person, and communication plan.
- [ ] **Rollback plan is ready** — Previous version is available. Rollback steps are documented and tested. Database rollback (if needed) is planned.
- [ ] **Deployment is executed during appropriate window** — Not during peak traffic. Not before a weekend (unless the team is prepared). Not during a freeze period.
- [ ] **Staged rollout is planned** — For major releases, consider canary deployment (1% → 10% → 50% → 100%) to catch issues early.
- [ ] **Feature flags control the rollout** — Major features can be toggled independently of the deployment. Enables gradual enablement.
- [ ] **Database migrations are deployed first** — Schema changes go out before application code that depends on them. Backward compatible.
- [ ] **Cache invalidation is planned** — If the release changes cached data or templates, caches are invalidated after deployment.
- [ ] **CDN cache is busted** — Static assets (JS, CSS) have cache-busting filenames or versioned paths. Old cached assets don't cause issues.
- [ ] **DNS changes (if any) are planned** — DNS TTLs are lowered before the release. DNS changes propagate during the deployment window.

### Common Mistakes
- Deploying everything at once without staged rollout
- Not deploying database migrations before application code
- Deploying right before a holiday weekend
- Not having the previous version artifact ready for rollback

---

## Post-Release Checklist

- [ ] **Smoke tests pass on production** — Run critical path tests against the live production environment immediately after deployment.
- [ ] **Monitoring shows stable metrics** — Error rates, latency, throughput, CPU, memory, and disk usage are within normal ranges for at least 30 minutes.
- [ ] **User feedback is monitored** — Check support channels (tickets, social media, in-app feedback) for issues related to the release.
- [ ] **Release is announced** — Internal announcement (Slack/email) and external announcement (blog post, social media, email) are published.
- [ ] **Feature flags are enabled gradually** — New features are enabled for increasing percentages of users. Monitor metrics at each stage.
- [ ] **Old version artifacts are cleaned up** — After confirming the release is stable (typically 24-48 hours), old Docker images and artifacts can be archived or deleted.
- [ ] **Release retrospective is conducted** — For major releases, conduct a retrospective: what went well, what didn't, and what to improve next time.
- [ ] **Technical debt introduced is tracked** — If shortcuts were taken for the release, create issues to address them. Don't let them accumulate.
- [ ] **Metrics baseline is updated** — Performance baselines, error rate baselines, and capacity planning numbers are updated to reflect the new version.
- [ ] **Support team is briefed** — Customer support has documentation about new features, known issues, and common questions for this release.
- [ ] **Next release planning begins** — Deferred features, reported issues, and retrospective items are captured for the next release cycle.

### Common Mistakes
- Not monitoring after deployment (assumes "deploy and forget")
- Enabling all features at 100% immediately (no gradual rollout)
- Not communicating the release to stakeholders
- Skipping the retrospective (misses learning opportunities)
- Not cleaning up old feature flags from previous releases

---

## Cross-References

- See `deployment.md` for detailed deployment procedures
- See `testing.md` for testing procedures referenced in this checklist
- See `security.md` for security review during releases
- See `backend.md` and `frontend.md` for development-specific pre-release checks
- See `database.md` for database migration procedures
