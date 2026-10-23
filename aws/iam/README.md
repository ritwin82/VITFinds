# GitHub Actions deployment identity

AWS account `159596244653` contains the OIDC provider
`token.actions.githubusercontent.com` and the role
`arn:aws:iam::159596244653:role/vitfinds-github-deploy`.

The role trusts only GitHub Actions tokens for `ritwin82/VITFinds` on `main`.
This repository uses GitHub's immutable OIDC subject format because it was
created after July 15, 2026. The trust policy includes the GitHub owner ID and
repository ID, so a renamed or recreated repository will require a review.

`github-deploy-policy.json` permits deployment to the existing `vitfinds`
CloudFormation stack, uploads to its SAM artifact and website buckets, updates
to existing VITFinds Lambda functions, and invalidation of its CloudFront
distribution. It does not permit deleting the stack or provisioning new AWS
services. Review and extend it when an infrastructure change needs additional
resources or actions.

The deployment job in `.github/workflows/deploy.yml` assumes the role with:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v6.3.0
    with:
      role-to-assume: arn:aws:iam::159596244653:role/vitfinds-github-deploy
      aws-region: ap-south-1
```

The policy and trust documents in this directory are copies of the currently
installed IAM configuration. A code edit to these files does not update IAM
until the corresponding AWS IAM API is called.
