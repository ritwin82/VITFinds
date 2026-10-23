[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')]
  [string]$SenderEmail,
  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9-]*$')]
  [string]$StackName = 'vitfinds',
  [ValidatePattern('^[a-z]{2}-[a-z]+-\d$')]
  [string]$Region = 'ap-south-1'
)
$ErrorActionPreference = 'Stop'

function Read-AwsJson {
  param([string[]]$Arguments)
  $result = & aws @Arguments --region $Region --output json
  if ($LASTEXITCODE -ne 0) { throw 'AWS request failed; no deployment was started.' }
  return $result | ConvertFrom-Json
}

# Check both prerequisites before modifying the deployed stack.
$identity = Read-AwsJson -Arguments @('sesv2','get-email-identity','--email-identity',$SenderEmail)
if (-not $identity.VerifiedForSendingStatus) { throw 'Verify the SES sender using the link in its inbox first.' }
$account = Read-AwsJson -Arguments @('sesv2','get-account')
if (-not $account.ProductionAccessEnabled) {
  throw "SES production access is not approved (review: $($account.Details.ReviewDetails.Status)). Cognito was not changed."
}
if (-not $account.SendingEnabled) { throw 'SES sending is disabled. Cognito was not changed.' }
$stack = Read-AwsJson -Arguments @('cloudformation','describe-stacks','--stack-name',$StackName)
$stackAccountId = $stack.Stacks[0].StackId.Split(':')[4]
$sourceArn = "arn:aws:ses:${Region}:${stackAccountId}:identity/$SenderEmail"
$domains = ($stack.Stacks[0].Parameters | Where-Object ParameterKey -eq 'UniversityDomains').ParameterValue
if (-not $domains) { throw 'The stack has no UniversityDomains parameter.' }

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  & node scripts/build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  & sam deploy --template-file aws/template.yaml --stack-name $StackName --region $Region `
    --resolve-s3 --s3-prefix $StackName --capabilities CAPABILITY_IAM `
    --parameter-overrides "UniversityDomains=$domains" "SesSourceArn=$sourceArn" "SesFromAddress=$SenderEmail" `
    --no-confirm-changeset --no-fail-on-empty-changeset
  if ($LASTEXITCODE -ne 0) { throw 'SES activation deployment failed. Check CloudFormation events.' }
  Write-Output 'Cognito now uses the verified SES sender. Test a fresh verification-code request from the website.'
} finally { Pop-Location }
