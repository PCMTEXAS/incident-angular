# DigitalChalk AWS Architecture — Kiro Steering Document
**Version:** 1.0 | **Date:** 2026-04-04 | **Organization:** DigitalChalk / PCM Texas

---

## Purpose

This steering document instructs Kiro to generate, review, and assist with infrastructure code,
application code, and architectural decisions aligned to DigitalChalk's AWS environment. All
suggestions must conform to the **AWS Well-Architected Framework (WAF)** across all six pillars:
Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and
Sustainability.

---

## 1. Account & Landing Zone Structure

DigitalChalk runs a multi-account AWS environment using **AWS Control Tower / Landing Zone**.

### Account Layout

| Account | Purpose |
|---|---|
| `management` | Billing, SCPs, AWS Organizations root |
| `security` | GuardDuty aggregator, Security Hub, CloudTrail lake |
| `shared-services` | Transit Gateway, Route 53 Resolver, shared ECR |
| `production` | Live DigitalChalk LMS workload |
| `staging` | Pre-production mirror |
| `sandbox` | Developer experimentation |

### Rules
- **Never deploy application workloads into the management account.**
- All new accounts must be vended through the Account Factory (via AWS Service Catalog or Control Tower AFT).
- Service Control Policies (SCPs) are authoritative — do not suggest workarounds that require SCP exceptions.
- All accounts share centralized logging: CloudTrail → S3 in the `security` account.
- AWS Config is enabled in all accounts; conformance packs enforce CIS AWS Foundations Benchmark.

---

## 2. Networking

- **VPC design:** Three-tier (public / private-app / private-data) across three AZs minimum.
- **Internet egress:** NAT Gateways per AZ in the production VPC; no direct internet routes from private subnets.
- **Cross-account connectivity:** AWS Transit Gateway — never VPC peering for production traffic.
- **DNS:** Route 53 private hosted zones; resolver endpoints in `shared-services` account.
- **No public IP addresses on EC2 or Lambda ENIs** unless explicitly required and documented.
- Security Groups: deny-all default; open only the minimum required ports. Prefer prefix lists over CIDRs.
- Use **AWS PrivateLink** for all S3 and DynamoDB access from within VPCs (VPC endpoints — gateway type for S3/DynamoDB, interface type for other services).

---

## 3. Compute — AWS Lambda

DigitalChalk's backend is serverless-first. Lambda is the primary compute layer.

### Standards
- **Runtime:** Node.js 22.x or Python 3.13 — always pin to a specific, current runtime; never use `provided.al2` without justification.
- **Memory:** Start at 512 MB; tune with AWS Lambda Power Tuning before production.
- **Timeout:** Set conservatively (≤ 30 s for API-facing functions); document any exceptions.
- **Concurrency:** Set reserved concurrency on critical functions to prevent noisy-neighbor throttling.
- **Deployment:** Use Lambda aliases + weighted traffic shifting for blue/green deploys.
- **Packaging:** Prefer Lambda layers for shared dependencies; keep function zip ≤ 5 MB unzipped where possible.
- **Environment variables:** All sensitive values must come from **AWS Secrets Manager** or **Parameter Store (SecureString)**; never hardcode credentials.
- **VPC attachment:** Attach Lambda to private-app subnets when it needs DynamoDB or internal APIs; use VPC endpoints so traffic stays on the AWS backbone.
- **Dead Letter Queues:** All async-invoked Lambdas must have an SQS DLQ configured.
- **X-Ray:** Enable active tracing on all production functions.

### WAF Alignment
- *Operational Excellence:* Structured JSON logs to CloudWatch Logs; log group retention ≤ 90 days in non-prod, 1 year in prod.
- *Reliability:* Idempotency keys on write operations; exponential backoff on retries.
- *Performance:* Minimize cold starts — use Provisioned Concurrency for latency-sensitive paths.
- *Cost:* Right-size memory; use Graviton (arm64) architecture unless a dependency blocks it.

---

## 4. Data — Amazon DynamoDB

DynamoDB is the primary operational datastore for DigitalChalk's LMS data (users, courses, enrollments, completions).

### Design Rules
- **On-demand capacity** for all tables unless a table has highly predictable traffic — then use provisioned + auto-scaling.
- **Single-table design preferred** for tightly related access patterns. Document the access pattern map before finalizing the schema.
- **Partition key design:** High-cardinality keys only; never use status flags or dates alone as partition keys.
- **GSIs:** Create only for documented, production access patterns. Avoid speculative GSIs.
- **TTL:** Enable TTL on ephemeral items (sessions, tokens, temp records) to reduce storage costs.
- **Encryption:** Server-side encryption with **AWS KMS Customer Managed Keys (CMK)**; key policy must restrict access to the owning account's IAM principals.
- **Point-in-Time Recovery (PITR):** Enabled on all production tables — no exceptions.
- **DynamoDB Streams:** Use for event-driven downstream processing (e.g., completion events triggering Lambda); prefer Kinesis Data Streams adapter for high-volume tables.
- **Backups:** On-demand backups before any schema or data migration.
- **No scans in production code paths.** All queries must use a partition key. Document any necessary full-table scan jobs as offline/batch processes.
- **VPC endpoint:** All Lambda → DynamoDB traffic must traverse the gateway VPC endpoint.

### WAF Alignment
- *Security:* CMK encryption; no wildcard `dynamodb:*` IAM actions; prefer fine-grained access conditions (`dynamodb:LeadingKeys`).
- *Reliability:* PITR + on-demand backups; multi-AZ by default.
- *Performance:* DAX for read-heavy, microsecond-latency paths (e.g., course catalog lookups).
- *Cost:* TTL to expire stale data; on-demand vs. provisioned decision documented per table.

---

## 5. Storage — Amazon S3

S3 stores course content, SCORM packages, completion certificates, and user-uploaded assets.

### Bucket Conventions
- **Naming:** `digitalchalk-{env}-{purpose}` (e.g., `digitalchalk-prod-course-content`).
- **One bucket per purpose** — do not mix content types in a single bucket.
- **Block all public access** at the account level and at individual buckets unless a bucket is explicitly a public static-asset CDN origin.
- **CloudFront-only access:** Content delivery buckets must use **Origin Access Control (OAC)**; direct S3 URLs must be blocked.
- **Versioning:** Enabled on all production buckets.
- **MFA Delete:** Enabled on production buckets containing course content and certificates.
- **Encryption:** SSE-KMS with a CMK per bucket; key rotation enabled annually.
- **Lifecycle policies:** Transition objects to S3-IA after 90 days, Glacier Instant Retrieval after 365 days for course archives.
- **Object Lock:** Enable in Compliance mode for certificate and completion-record buckets (regulatory retention requirement).
- **Replication:** Cross-region replication to `us-west-2` for production content buckets.
- **Access logging:** Server access logs → `digitalchalk-{env}-s3-access-logs` bucket (separate, log-only bucket).
- **Pre-signed URLs:** Use for all user file upload/download flows; maximum expiry 15 minutes.
- **No `s3:*` wildcard IAM grants** — scope to specific actions and bucket ARNs with prefix conditions.

### WAF Alignment
- *Security:* Public access blocked; OAC; CMK; Object Lock for compliance data.
- *Reliability:* Versioning; cross-region replication.
- *Cost:* Intelligent-Tiering on long-lived, access-pattern-unknown data; lifecycle policies on archive content.

---

## 6. Security — Horizontal Standards

These rules apply across all AWS services and all code Kiro generates.

### IAM
- **Least privilege always.** Every IAM role must have a documented purpose; permissions scoped to the minimum required actions and resources.
- **No inline policies** on users. Use managed policies attached to roles.
- **No IAM users with long-term access keys** in production. Use IAM roles + instance profiles / Lambda execution roles / IRSA.
- **Permission boundaries** on all developer-vended roles.
- **Require MFA** for all human IAM users in the management and security accounts.
- **Service Control Policies** must not be bypassed. If an SCP blocks something, escalate — do not create exceptions.

### Secrets Management
- All database credentials, API keys, and tokens → **AWS Secrets Manager** with automatic rotation.
- Parameter Store (`/digitalchalk/{env}/...` hierarchy) for non-secret configuration values.
- Never log secret values. Add `[REDACTED]` placeholders in log lines that might contain sensitive fields.

### Encryption
- **In transit:** TLS 1.2 minimum; TLS 1.3 preferred. No plain HTTP endpoints.
- **At rest:** KMS CMK on all datastores (DynamoDB, S3, SQS, SNS, CloudWatch Logs groups).
- **Key management:** One CMK per service per environment; key aliases follow `alias/digitalchalk-{env}-{service}`.

### Network Security
- **WAF (AWS WAF)** in front of all CloudFront distributions and ALBs:
  - Enable AWS Managed Rules (Core Rule Set + Known Bad Inputs).
  - Enable AWS Managed Rules for Amazon IP Reputation List.
  - Rate limiting: 2,000 requests per 5 minutes per IP on auth endpoints.
  - Geo-blocking: block regions with no business activity (configure per compliance guidance).
  - Log all WAF requests to S3 → Athena for analysis.
- **Shield Standard** is automatic. Evaluate Shield Advanced for production CloudFront + Route 53.
- **VPC Flow Logs:** Enabled on all production and staging VPCs; retained 90 days.
- **GuardDuty:** Enabled in all accounts; findings aggregated to `security` account.
- **Security Hub:** Enabled; standards: AWS Foundational Security Best Practices v1.0.0 + CIS AWS Foundations v1.4.0.
- **Macie:** Enabled on S3 buckets containing PII (user data, certificates).

### Vulnerability & Compliance
- **Amazon Inspector:** Enabled for Lambda function code scanning and ECR image scanning.
- **Dependabot / npm audit / pip-audit:** Run in CI/CD on every PR.
- **No high or critical CVEs** may be deployed to production without documented risk acceptance.

---

## 7. Observability

- **Structured logging:** JSON only, with fields: `level`, `requestId`, `userId` (hashed), `service`, `message`, `timestamp` (ISO 8601).
- **Metrics:** Custom CloudWatch metrics for business KPIs (course completions, enrollments, active users) — namespace `DigitalChalk/{Env}`.
- **Dashboards:** One CloudWatch dashboard per service; one aggregate ops dashboard per environment.
- **Alarms:** All P0 alarms → SNS → PagerDuty. All P1 alarms → SNS → Slack `#ops-alerts`.
- **Tracing:** AWS X-Ray with sampling rate 5% in production; 100% in staging.
- **Synthetic monitoring:** CloudWatch Synthetics canaries on critical user flows (login, course launch, completion).

---

## 8. CI/CD & IaC

- **IaC tool:** AWS CDK (TypeScript) — all infrastructure must be code; no ClickOps in production.
- **CDK best practices:** Use `cdk-nag` to enforce WAF rules as part of `cdk synth`; fail the build on suppressed findings without a documented reason.
- **Pipeline:** AWS CodePipeline or GitHub Actions → CodeBuild → CDK deploy.
- **Environments:** Changes flow `sandbox → staging → production` with manual approval gates before production.
- **Drift detection:** AWS Config rules + CDK drift detection run nightly; alerts on any detected drift.
- **Tagging:** All resources must have: `Environment`, `Service`, `Owner`, `CostCenter`, `Project=DigitalChalk`.

---

## 9. Cost Optimization

- **Cost allocation tags** are mandatory (see §8 Tagging).
- **Budgets:** AWS Budgets alerts at 80% and 100% of monthly forecast per account.
- **Savings Plans:** Compute Savings Plans covering baseline Lambda + Fargate usage reviewed quarterly.
- **Idle resource detection:** AWS Trusted Advisor + Cost Explorer anomaly detection; alerts to `#finops`.
- **Reserved capacity:** DynamoDB provisioned tables with predictable load → Reserved Capacity.
- **Data transfer:** Prefer S3 Transfer Acceleration only when justified by latency measurements; avoid unnecessary cross-AZ traffic.

---

## 10. Kiro-Specific Behavior Rules

When generating or reviewing code and infrastructure in this project, Kiro must:

1. **Default to serverless** (Lambda + DynamoDB + S3) before suggesting EC2 or containers.
2. **Reject any suggestion** that disables encryption at rest or in transit.
3. **Flag immediately** any IAM policy with `*` in `Action` or `Resource` and refuse to generate it without explicit user override and documented justification.
4. **Enforce VPC endpoints** — never generate Lambda code that calls DynamoDB or S3 without a VPC endpoint being declared in the accompanying CDK stack.
5. **Always include a DLQ** when generating async Lambda event source mappings.
6. **Include `cdk-nag` suppression comments** with a documented reason any time a WAF rule must be suppressed.
7. **Never suggest hardcoding** API keys, database credentials, or secrets in code or CDK stacks.
8. **Apply retention policies** whenever generating CloudWatch Log Groups.
9. **Tag every CDK construct** with the required tags from §8.
10. **Reference the Well-Architected pillar** in comments when making a non-obvious architectural tradeoff.

---

## 11. Prohibited Patterns

The following are hard stops — Kiro must refuse to generate or must flag as blocking issues:

| Pattern | Reason |
|---|---|
| `s3.BlockPublicAccess` set to anything other than `BLOCK_ALL` on non-CDN buckets | Security — public data exposure |
| DynamoDB table without PITR enabled | Reliability — data loss risk |
| Lambda with timeout > 15 minutes | Architectural — use Step Functions or Fargate |
| IAM `Effect: Allow` with `Action: "*"` | Security — over-permissive |
| Plain HTTP endpoints (no TLS) | Security — data in transit |
| Secrets or API keys in environment variables (literal values) | Security — credential exposure |
| CloudFormation/CDK stack deployed directly to production without staging validation | Reliability — unvalidated changes |
| S3 bucket with server access logging disabled | Compliance — audit trail |
| DynamoDB `Scan` in a synchronous API path | Performance — unbounded latency |
| Resources without required cost allocation tags | Cost — unattributable spend |

---

*This document is the authoritative steering source for Kiro in the DigitalChalk AWS environment.
Update it via pull request with CTO/CRO review before any production architectural changes.*
