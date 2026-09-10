# VITFinds

A student lost-and-found platform and campus marketplace. Includes a working local demo and an AWS deployment template. The local app needs only Node.js 22 or newer; there are no frontend dependencies to install.

## Run locally

```powershell
node server.mjs
```

Open http://127.0.0.1:3000. The local server binds only to loopback and starts with clearly labeled sample listings. Use **Switch account** to try Alex, Priya, Arjun, or the campus moderator. No passwords or email verification are simulated. This demo login must never be exposed on a public server.

The backend saves changes in `.data/state.json` and photos in `.data/uploads/`; both are ignored by Git. Local sessions last 24 hours or until server restart. The development server automatically opens Alex's sample account on a fresh page load. AWS mode never offers demo authentication or seeds sample records.

## Implemented

- Lost, found, and marketplace listings with up to three photos, category, date, and campus location.
- Search, category/location filters, price sorting, personal saved items, and My Listings.
- Owner-only editing and removal of listings; removal keeps existing conversations available.
- Marketplace prices, condition, negotiability, offers through private messages, and active/reserved/sold status.
- Private ownership claims, finder review, return confirmation, and resolution of competing claims.
- Basic possible matches for lost reports, using category and location; not AI image matching.
- Private conversations, persistent messages, in-app notifications, and periodic refresh.
- Reporting, moderator-only review, and removal of reported listings.
- Responsive interface, native accessible dialogs, escaped student content, validation, ownership checks, and participant checks.
- AWS university-email signup, confirmation, sign-in, password reset, and verified-email enforcement.
- Optional WebMCP search and saved-item tools, feature-detected. These are not tested in a live WebMCP browser.

## Verify and build

```powershell
node --test tests/*.test.mjs
node scripts/build.mjs
```

The build checks JavaScript syntax, copies the web app to `dist/`, and stages only Lambda source files in `.aws-build/`. It does not package local demo data. Tests cover access control, claim privacy, competing claims, validation, saved items, moderation, HTTP sessions, CSRF, photo upload, and persistence.

## Deploy to AWS

Prerequisites: an AWS account, configured AWS CLI credentials, and AWS SAM CLI. Deployment provisions billable resources. No AWS resources have been created by building locally.

The template provisions Cognito, API Gateway HTTP API with JWT authorization, Lambda, DynamoDB, a private S3 bucket, and CloudFront with origin access control. Photos are served through CloudFront at unguessable URLs and should not contain sensitive documents. Direct S3 public access is blocked. The Lambda runtime supplies the AWS SDK v3 clients used by this project.

```powershell
node scripts/build.mjs
sam validate --lint --template-file aws/template.yaml
sam deploy --guided --template-file aws/template.yaml
```

Choose a stack name such as `vitfinds`, a region such as `ap-south-1`, and the approved university email domain parameter. Review and approve the generated change set. After deployment, substitute your selected stack and region:

```powershell
node scripts/configure-aws.mjs vitfinds ap-south-1
aws cloudformation describe-stacks --stack-name vitfinds --region ap-south-1 --query "Stacks[0].Outputs"
aws s3 sync dist/ s3://YOUR_SITE_BUCKET --region ap-south-1
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths '/*'
```

Use the actual `SiteBucket` and `DistributionId` outputs in the last two commands. `configure-aws.mjs` writes only public configuration into `dist/config.js`; it does not store AWS credentials. Always run configuration **after** the build, because the build restores local demo configuration in `dist/`. Never deploy an unconfigured `dist/` build. The frontend SiteUrl is an HTTPS CloudFront URL.

Create and verify a university student account through the deployed app. Assign a moderator explicitly through Cognito:

```powershell
aws cognito-idp admin-add-user-to-group --user-pool-id YOUR_USER_POOL_ID --username moderator@vitstudent.ac.in --group-name Admins --region ap-south-1
```

Sign out and back in to obtain the new group claim. Users cannot grant themselves admin access. Cognito's default email delivery is suitable for initial testing; configure SES delivery and quotas for a broader launch.

AWS references: [SAM JWT authorizers](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-controlling-access-to-apis-oauth2-authorizer.html), [DynamoDB document client](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-dynamodb-doc-client.html).

## Scope and remaining production work

This is a functional first release, not every advanced idea from the feature brainstorm. Payments, seller ratings, image matching/OCR, email/push alerts, map integration, blocking, and automatic expiry are not implemented. Messages and offers are text-based; there is no payment or order processing. Listing removal archives the record rather than permanently deleting it.

The AWS adapter scans paginated records and performs conditional transactional writes. It is intended for an initial campus pilot. Before wider launch, replace full-state reads with indexed, paginated per-user queries, add retention policies, and monitor payload size and costs. Mark-all-read and competing-claim resolution have DynamoDB's 100-action transaction ceiling. JWT sessions expire after one hour and require sign-in again. Uploaded but unpublished photos require an orphan cleanup policy. AWS deployment and browser interaction tests must be performed in a configured environment before production use.

## Project structure

| Path | Purpose |
| --- | --- |
| `public/` | Browser interface and public configuration |
| `src/domain.mjs` | Shared validation, permissions, and workflows |
| `server.mjs` | Local demo API and persistent storage |
| `aws/` | Production Lambda adapters and SAM infrastructure |
| `scripts/` | Build and AWS frontend configuration |
| `tests/` | Domain and HTTP integration tests |
