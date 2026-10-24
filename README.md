# VITFinds

A student lost-and-found platform and campus marketplace. Includes a working local demo and an AWS deployment template. The local app needs only Node.js 22 or newer; there are no frontend dependencies to install.

## Run locally

```powershell
node server.mjs
```

Open http://127.0.0.1:3000. Create a local account with a Gmail address and a strong password, or use the clearly labeled demo account shortcut. Use **Switch account** to try Alex, Priya, Arjun, or the campus moderator. The demo login must never be exposed on a public server.

The backend saves changes in `.data/state.json`, photos in `.data/uploads/`, and a randomly generated JWT signing secret in `.data/jwt-secret`; all are ignored by Git. Passwords are hashed with Node.js `scrypt` and unique salts. Local JWTs use HS256 signatures, expire after 24 hours, are stored in browser session storage, and are revoked in memory on logout. Local accounts validate the configured email domain but cannot prove ownership of that address because no email service is used. AWS mode uses Cognito email verification and never offers demo authentication or seeds sample records.

## Implemented

- Lost, found, and marketplace listings with up to three photos, category, date, and campus location.
- Search, category/location filters, price sorting, personal saved items, and My Listings.
- Owner-only editing and removal of listings; removal keeps existing conversations available.
- Marketplace prices, condition, negotiability, offers through private messages, and active/reserved/sold status.
- Private ownership claims, finder review, return confirmation, and resolution of competing claims.
- Basic possible matches for lost reports, using category and location; not AI image matching.
- Private conversations, persistent messages, live delivery, unread counts, read receipts, and in-app notifications.
- Reporting, moderator-only review, and removal of reported listings.
- Responsive interface, native accessible dialogs, escaped student content, validation, ownership checks, and participant checks.
- AWS Gmail signup, confirmation, sign-in, password reset, and verified-email enforcement.
- Local signup and login with scrypt password hashing, signed JWT authentication, expiry checks, login throttling, and protected API routes.
- Optional WebMCP search and saved-item tools, feature-detected. These are not tested in a live WebMCP browser.

## Verify and build

```powershell
node --test tests/*.test.mjs
node scripts/build.mjs
```

The build checks JavaScript syntax, copies the web app to `dist/`, and stages only Lambda source files in `.aws-build/`. It does not package local demo data. Tests cover access control, claim privacy, competing claims, validation, saved items, moderation, HTTP sessions, CSRF, photo upload, and persistence.

## Focused read APIs

All routes below require the signed-in user's bearer token. They complement the existing `/api/state` response used by the current browser UI.

| Route | Result |
| --- | --- |
| `GET /api/listings` | Browse visible listings with `type`, `category`, `location`, `status`, `q`, and `sort` filters |
| `GET /api/listings/:id` | Get one visible listing; archived listings return 404 |
| `GET /api/me` | Get the current user's safe profile and own email address |
| `GET /api/me/saved-listings` | Get the current user's visible saved listings |
| `GET /api/conversations` | Get only conversations involving the current user |
| `GET /api/conversations/:id/messages` | Get message history for a conversation participant |
| `GET /api/notifications` | Get only the current user's notifications |

Collection routes return `{ items, nextCursor, total }`. Pass `limit=1` through `50` (default `20`) and use the returned `nextCursor` as the next request's `cursor`. Message pages contain the newest messages in chronological display order; the cursor requests older history. Listing sort values are `newest` (default), `oldest`, `price-asc`, and `price-desc`. A cursor is tied to its filters, sort, resource, and user. The AWS adapter still scans the existing DynamoDB table before applying these filters, so response pagination currently reduces payload size but not DynamoDB read work. Indexed queries are required before a wider rollout.

## Deploy to AWS

Prerequisites: an AWS account, configured AWS CLI credentials, and AWS SAM CLI. Deployment provisions billable resources. No AWS resources have been created by building locally.

The template provisions Cognito, API Gateway HTTP and WebSocket APIs, Lambda, DynamoDB, a private S3 bucket, and CloudFront with origin access control. Photos are served through CloudFront at unguessable URLs and should not contain sensitive documents. Direct S3 public access is blocked. The Lambda runtime supplies the AWS SDK v3 clients used by this project.

Live chat uses an authenticated event stream in local development and a WebSocket API on AWS. The browser obtains a one-use, 60-second connection ticket through the Cognito-protected HTTP API. The WebSocket authorizer consumes that ticket and registers the connection. Messages and read receipts are saved first; connected participants then receive a small sync event and fetch their authorized state. Disconnected clients catch up on reconnect, with a 60-second reconciliation check as a fallback. The server never sends message text in the WebSocket event. Read means the recipient opened the conversation; Sent means the server stored the message. A live AWS deployment still needs to be validated in an AWS account.

```powershell
node scripts/build.mjs
sam validate --lint --template-file aws/template.yaml
sam deploy --guided --template-file aws/template.yaml
```

Choose a stack name such as `vitfinds`, a region such as `ap-south-1`, and the allowed email-domain parameter (gmail.com). Review and approve the generated change set. After deployment, substitute your selected stack and region:

```powershell
node scripts/configure-aws.mjs vitfinds ap-south-1
aws cloudformation describe-stacks --stack-name vitfinds --region ap-south-1 --query "Stacks[0].Outputs"
aws s3 sync dist/ s3://YOUR_SITE_BUCKET --region ap-south-1
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths '/*'
```

Use the actual `SiteBucket` and `DistributionId` outputs in the last two commands. `configure-aws.mjs` writes only public configuration, including `WebSocketUrl`, into `dist/config.js`; it does not store AWS credentials. Always run configuration **after** the build, because the build restores local demo configuration in `dist/`. Never deploy an unconfigured `dist/` build. The frontend SiteUrl is an HTTPS CloudFront URL.

Create and verify a Gmail account through the deployed app. Assign a moderator explicitly through Cognito:

```powershell
aws cognito-idp admin-add-user-to-group --user-pool-id YOUR_USER_POOL_ID --username moderator@gmail.com --group-name Admins --region ap-south-1
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
