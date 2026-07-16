# Security Audit Checklist

> **Purpose:** Comprehensive security audit checklist covering authentication, authorization, input validation, data protection, API security, infrastructure security, and incident response.
> **AI Instructions:** Use this checklist when performing a security audit or review. Every item must be explicitly checked. Items that are not applicable must be marked with `- [x] N/A` with a justification. Security is not optional — there are no "nice to have" items in this checklist. Cross-reference with `backend.md`, `api.md`, and `database.md` for implementation-specific security items.

---

## Authentication Checklist

- [ ] **Password requirements are enforced** — Minimum 12 characters, complexity requirements (uppercase, lowercase, numbers, symbols), checked against breached password databases (HaveIBeenPwned API).
- [ ] **Passwords are hashed securely** — Use bcrypt (cost factor ≥12), scrypt, or Argon2id. Never MD5, SHA-1, or SHA-256 for passwords. No custom hashing schemes.
  ```
  # Good: bcrypt with proper cost
  bcrypt.hashpw(password, bcrypt.gensalt(rounds=12))

  # Good: Argon2id (recommended for new projects)
  argon2.hash_secret(password, salt, time_cost=3, memory_cost=65536, parallelism=4)

  # Bad
  sha256(password + salt)  # Too fast, GPU-attackable
  md5(password)            # Broken
  ```
- [ ] **Account lockout is implemented** — After 5-10 failed login attempts, account is locked for a progressive duration (exponential backoff). CAPTCHA after 3 failures.
- [ ] **Multi-factor authentication is supported** — TOTP (Google Authenticator, Authy), WebAuthn/FIDO2 (hardware keys), or SMS as fallback. MFA required for admin accounts.
- [ ] **Session management is secure** — Sessions expire after inactivity (15-30 minutes for sensitive apps). Session IDs are regenerated after login. Session fixation is prevented.
- [ ] **Token security is proper** — JWT tokens use RS256 or ES256 (not HS256 in distributed systems). Access tokens expire in 15 minutes. Refresh tokens are single-use and rotated.
- [ ] **OAuth/OIDC is properly configured** — State parameter is used to prevent CSRF. Redirect URIs are validated exactly (no wildcard matching). Tokens are validated (signature, issuer, audience, expiry).
- [ ] **Password reset is secure** — Reset tokens expire (1 hour max). Tokens are single-use. Reset process doesn't reveal whether an account exists. Old tokens are invalidated when a new one is generated.
- [ ] **Social login is handled safely** — Email from social providers is verified. Account linking prevents takeover. Provider-specific token validation is performed.
- [ ] **Credential storage is secure** — Secrets are in a secrets manager, not in code, config files, or environment variable files committed to version control.

### Common Mistakes
- Using HS256 for JWT (allows token forgery if secret leaks)
- Not rate-limiting login attempts (enables brute force)
- Showing "account not found" vs "wrong password" (allows enumeration)
- Long-lived session tokens without revocation mechanism

---

## Authorization Checklist

- [ ] **Principle of least privilege is applied** — Users, services, and systems have the minimum permissions needed. No blanket admin access.
- [ ] **Authorization is checked server-side** — Every endpoint, every function call. Client-side authorization checks are for UX only, never for security.
- [ ] **Insecure Direct Object Reference (IDOR) is prevented** — Users cannot access other users' resources by changing IDs. Ownership is verified on every access.
  ```
  # Vulnerable to IDOR
  GET /api/v1/invoices/:invoice_id
  → Returns invoice if user is authenticated (but not if they own it)

  # Secure
  GET /api/v1/invoices/:invoice_id
  → Verify user owns the invoice OR has admin role
  → Return 404 if unauthorized (not 403)
  ```
- [ ] **Role-based access control is properly implemented** — Roles are assigned correctly. Role checks are in the service layer, not just the route/controller layer.
- [ ] **Admin access is separately controlled** — Admin functionality uses a different path, different authentication, and enhanced logging. Admin role assignment requires elevated approval.
- [ ] **Service-to-service authorization is implemented** — Internal service calls use mTLS, signed tokens, or API keys. No implicit trust between services.
- [ ] **Authorization is tested** — Attempt to access resources as different users with different roles. Verify unauthorized access is denied. Test privilege escalation paths.
- [ ] **Time-based access control works correctly** — If access expires (trial, subscription), it's enforced immediately. No grace period without explicit approval.
- [ ] **Multi-tenant isolation is verified** — In multi-tenant systems, verify complete data isolation between tenants. Test cross-tenant access attempts.

### Common Mistakes
- Checking authorization only at the route level (middleware)
- Returning 403 instead of 404 for unauthorized access (leaks resource existence)
- Trusting client-provided user IDs instead of deriving from the authenticated session
- Not revoking access immediately when roles change

---

## Input Validation Checklist

- [ ] **All input is validated at the server boundary** — HTTP parameters, headers, cookies, request bodies, URL paths, and file uploads are all validated.
- [ ] **Validation uses whitelists, not blacklists** — Define what's acceptable and reject everything else. Blacklists are always incomplete.
  ```python
  # Bad: Blacklist (misses many attack vectors)
  if '<script>' in user_input:
      reject()

  # Good: Whitelist (rejects anything unexpected)
  if not re.match(r'^[a-zA-Z0-9_\-\.]+$', username):
      reject("Username contains invalid characters")
  ```
- [ ] **SQL injection is prevented** — All database queries use parameterized statements or ORM query builders. No string concatenation of user input into SQL.
- [ ] **XSS prevention is implemented** — Output encoding based on context (HTML, JavaScript, URL, CSS). Use template engines with auto-escaping. Never use `innerHTML` or `document.write` with user data.
- [ ] **Command injection is prevented** — No user input in shell commands. Use language-native APIs instead of shelling out. If shelling out is unavoidable, use argument arrays, not string concatenation.
- [ ] **Path traversal is prevented** — User-supplied file paths are validated against a whitelist of allowed directories. Use `os.path.realpath()` and verify the resolved path is within the allowed directory.
- [ ] **XXE (XML External Entity) is prevented** — XML parsers disable external entity processing. Use JSON instead of XML where possible.
- [ ] **Deserialization is safe** — Never deserialize untrusted data using `pickle`, `yaml.load()` (without `SafeLoader`), or equivalent insecure deserializers.
- [ ] **File upload validation is thorough** — Validate file type by magic bytes (not extension). Limit file size. Store outside web root. Scan for malware. Generate random filenames.
- [ ] **Content-Type is validated** — Request Content-Type header matches the actual body content. Don't blindly parse JSON from a request claiming to be XML.
- [ ] **Error messages don't leak information** — Validation errors say what's wrong, not how the system works. No stack traces, database queries, or internal paths in error responses.

### Common Mistakes
- Client-side-only validation (trivially bypassed)
- Using regex for complex validation (email, URLs) — use libraries
- Trusting `Content-Type` headers without verification
- Not validating numeric ranges (negative IDs, zero quantities)

---

## Data Protection Checklist

- [ ] **Sensitive data is classified** — Data is categorized by sensitivity level: public, internal, confidential, restricted. Each level has corresponding protection requirements.
- [ ] **Encryption at rest is enabled** — All sensitive data is encrypted at rest using AES-256 or equivalent. Full-disk encryption, database-level encryption, and column-level encryption for highly sensitive data.
- [ ] **Encryption in transit is enforced** — All data in transit uses TLS 1.2+ (prefer TLS 1.3). HSTS headers are set. Certificate pinning for mobile apps where appropriate.
- [ ] **PII is handled according to regulations** — GDPR, CCPA, HIPAA, or other applicable regulations are followed. Data minimization: collect only what's needed.
- [ ] **Data retention policies are implemented** — Data is automatically deleted or anonymized after the retention period. Retention periods are documented and justified.
- [ ] **Right to deletion is supported** — Users can request account and data deletion. Deletion is complete and verifiable. Deletion doesn't affect data needed for legal compliance.
- [ ] **Sensitive data is masked in logs** — Passwords, tokens, credit card numbers, SSNs, health data, and API keys are never logged. Use structured logging with field-level masking.
  ```python
  # Good: Structured logging with masking
  logger.info("Payment processed", extra={
      "user_id": user.id,
      "amount": amount,
      "card_last_four": card.number[-4:],  # Masked
      "card_expiry": card.expiry,
      # card.number is NOT logged
  })
  ```
- [ ] **Data minimization is practiced** — Collect only data that's needed. Don't store raw API responses that contain more data than needed. Strip PII before logging.
- [ ] **Backup encryption is verified** — All backups are encrypted. Encryption keys are managed separately from backups. Key rotation is scheduled.
- [ ] **Data access is audited** — Who accessed sensitive data, when, and why is logged. Audit logs are immutable and retained per compliance requirements.
- [ ] **Anonymization is used where possible** — For analytics and testing, use anonymized or synthetic data. Production data should not be used in development or test environments.
- [ ] **Secure data disposal** — When data is deleted, it's securely erased. Database records are overwritten, not just marked as deleted. Physical media is destroyed per NIST 800-88.

### Common Mistakes
- Logging PII in debug or application logs
- Using production data in test environments without anonymization
- Not encrypting backups (compliance violation)
- Keeping data "just in case" without a retention policy

---

## API Security Checklist

- [ ] **Rate limiting is implemented** — All endpoints have rate limits. Authentication endpoints have stricter limits. Rate limits are per-user, per-IP, and global.
- [ ] **CORS is configured restrictively** — Only specific allowed origins. No `Access-Control-Allow-Origin: *` in production. Credentials only sent to trusted origins.
- [ ] **Content Security Policy (CSP) is enforced** — Strict CSP header prevents XSS. `script-src` restricts inline scripts and external script sources. Report violations.
- [ ] **Security headers are set** — All responses include:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 0  (rely on CSP instead)
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; ...
  ```
- [ ] **API versioning is implemented** — Deprecated API versions are documented with sunset dates. Unmaintained versions are shut down.
- [ ] **Webhook signatures are verified** — Incoming webhooks are validated using HMAC signatures. Timestamps are checked to prevent replay attacks.
- [ ] **Request size limits are enforced** — Maximum request body size is enforced at the reverse proxy and application levels. Prevents memory exhaustion.
- [ ] **SSRF prevention is implemented** — User-supplied URLs are validated against an allowlist of internal networks. DNS rebinding attacks are prevented.
- [ ] **GraphQL-specific protections** — Query depth limiting, query complexity analysis, introspection disabled in production, and rate limiting per query cost.
- [ ] **Error responses are consistent** — No information leakage through error messages, response times, or response sizes. Uniform error format across all endpoints.
- [ ] **Third-party API keys are restricted** — API keys for external services (Stripe, AWS, etc.) have minimum required permissions and IP restrictions where possible.

### Common Mistakes
- No rate limiting (enables brute force and DoS)
- CORS `Allow-Origin: *` with credentials
- Not setting security headers (low-hanging fruit for attackers)
- Exposing GraphQL introspection in production

---

## Infrastructure Security Checklist

- [ ] **Network segmentation is implemented** — Application servers, databases, and management interfaces are in separate network segments. Firewall rules restrict inter-segment traffic.
- [ ] **SSH access is restricted** — SSH uses key-based authentication only (no passwords). SSH access is limited to bastion hosts. Root login is disabled.
- [ ] **Systems are patched regularly** — OS and application dependency security patches are applied within 72 hours for critical vulnerabilities. Patch management process is documented.
- [ ] **Container security is enforced** — Containers run as non-root users. Base images are minimal and scanned for vulnerabilities. No privileged containers in production.
- [ ] **Secrets management is centralized** — All secrets (API keys, passwords, certificates) are in a secrets manager (Vault, AWS Secrets Manager). No secrets in environment variable files or config repos.
- [ ] **Infrastructure as Code (IaC) is reviewed** — Terraform/CloudFormation changes go through code review. State files are encrypted and access-controlled. Drift detection is enabled.
- [ ] **Logging and monitoring are comprehensive** — All access logs, error logs, and audit logs are collected in a centralized system. Logs are immutable and retained per compliance requirements.
- [ ] **Intrusion detection is deployed** — Host-based and network-based IDS/IPS are configured. Alerts fire for suspicious activity (brute force, privilege escalation, data exfiltration).
- [ ] **DNS security is configured** — DNSSEC is enabled. DNS queries are logged for threat intelligence. Domain registrar lock is enabled.
- [ ] **Certificate management is automated** — TLS certificates are auto-renewed (Let's Encrypt, ACM). Expiry monitoring alerts 30+ days before expiry. No self-signed certificates in production.
- [ ] **DDoS protection is in place** — CDN and DDoS mitigation service (Cloudflare, AWS Shield) is configured. Rate limiting at the network level. Auto-scaling is configured.
- [ ] **Access control lists are reviewed quarterly** — User access, service accounts, and API keys are reviewed every quarter. Unused access is revoked. Former employee access is removed immediately.

### Common Mistakes
- Not rotating secrets/credentials regularly
- Running containers as root
- Storing Terraform state in unencrypted S3 buckets
- Not having a centralized secrets management solution

---

## Incident Response Checklist

- [ ] **Incident response plan exists** — Documented procedure for handling security incidents. Includes: detection, triage, containment, eradication, recovery, and post-incident review.
- [ ] **Incident response team is defined** — Clear roles: incident commander, communications lead, technical lead, legal counsel. Contact information is up to date.
- [ ] **Communication channels are predefined** — Dedicated channel (Slack, Teams) for incident communication. Out-of-band communication method if primary channel is compromised.
- [ ] **Escalation paths are documented** — When to escalate: severity levels, time-based triggers, and who to escalate to. Include external contacts (law enforcement, regulators, security consultants).
- [ ] **Playbooks exist for common incidents** — Documented procedures for: data breach, ransomware, DDoS, account compromise, credential leak, and malware detection.
- [ ] **Breach notification procedures are defined** — If PII is compromised, notification timelines are known (GDPR: 72 hours). Templates for user notifications are prepared. Legal requirements are documented.
- [ ] **Forensic capabilities are prepared** — Log retention is sufficient for investigation. Evidence preservation procedures are documented. Chain of custody is maintained.
- [ ] **Tabletop exercises are conducted** — Practice incident response scenarios at least twice a year. Identify gaps in the plan and update accordingly.
- [ ] **Post-incident review is mandatory** — After every security incident, conduct a blameless post-incident review. Document root cause, timeline, response effectiveness, and improvements.
- [ ] **Lessons learned are incorporated** — Post-incident improvements are tracked as action items and completed. Incident response plan is updated based on findings.

### Common Mistakes
- No incident response plan (discovering one during an incident is too late)
- Not practicing the response plan (it won't work when needed)
- Focusing on blame instead of systemic improvements
- Not notifying affected users within required timeframes

---

## Cross-References

- See `backend.md` for application-level security implementation
- See `api.md` for API-specific security measures
- See `database.md` for database security configuration
- See `deployment.md` for deployment security considerations
- See `testing.md` for security testing procedures
