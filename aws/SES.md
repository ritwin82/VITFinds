# Verification email with Amazon SES

SES is regional. Use `ap-south-1` for this app. Verify the sending email identity in SES and obtain SES production access before enabling it in the live Cognito pool. The SES sandbox only permits sending to verified recipients, even when the sender is verified.

The template's `SesSourceArn` and `SesFromAddress` parameters enable Cognito's `DEVELOPER` email mode. Both default to empty, which keeps Cognito's default sending service. Set both together. The existing user pool, accounts, and university-domain restriction are preserved. SES identity verification, account-level suppression, and the production-access review are account setup tasks outside this stack.

After AWS approves production access, run from PowerShell:

```powershell
$env:AWS_PROFILE = 'vitfinds'
& ./scripts/enable-ses.ps1 -SenderEmail 'YOUR_VERIFIED_SENDER_EMAIL'
```

The script checks sender verification, production access, and sending status before building or deploying. It refuses to switch Cognito while SES is sandboxed. A successful activation creates the `vitfinds-auth-email` configuration set and publishes send, delivery, delivery-delay, reject, bounce, complaint, and rendering-failure metrics to CloudWatch under `AWS/SES`, with dimension `application=vitfinds`.

The GitHub Actions SAM command preserves previously deployed values for optional email parameters when they are omitted, so later frontend deployments retain the activated sender. IAM policy files are copies: apply `aws/iam/github-deploy-policy.json` to the deployment role separately when its permissions change.

Verify activation in Cognito's email configuration, request a new code from the website, and check SES delivery/bounce metrics. A successful send API response does not establish inbox delivery; a delivery metric establishes acceptance by the receiving mail server, which may still apply filtering. Gmail addresses can be individually verified; a domain you control is preferable for control over DKIM and DMARC alignment.

To return to Cognito's default email service, deploy with both `SesSourceArn=` and `SesFromAddress=`. Existing accounts remain unchanged.

AWS references: [Cognito email](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html), [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).
