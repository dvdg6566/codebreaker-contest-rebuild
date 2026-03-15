# Packaging for One-Click Deployment

To create a CloudFormation Quick Create link, you need to package and host the templates in S3.

## Step 1: Create an S3 Bucket for Templates

```bash
aws s3 mb s3://codebreaker-templates-<your-unique-suffix> --region <your-region>
```

## Step 2: Package the Templates

```bash
sam package \
  --template-file template.yml \
  --output-template-file packaged.yml \
  --s3-bucket codebreaker-templates-<your-unique-suffix> \
  --s3-prefix templates
```

This uploads:
- Lambda code zip files to S3
- Nested templates to S3
- Produces `packaged.yml` with S3 URLs

## Step 3: Upload the Packaged Main Template

```bash
aws s3 cp packaged.yml s3://codebreaker-templates-<your-unique-suffix>/packaged.yml
```

## Step 4: Make Templates Public (for public Quick Create link)

```bash
# Option A: Make bucket public (use with caution)
aws s3api put-bucket-policy --bucket codebreaker-templates-<your-unique-suffix> --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::codebreaker-templates-<your-unique-suffix>/*"
  }]
}'

# Option B: Make specific objects public
aws s3api put-object-acl --bucket codebreaker-templates-<your-unique-suffix> --key packaged.yml --acl public-read
```

## Step 5: Generate Quick Create Link

```
https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate
  ?templateURL=https://codebreaker-templates-<your-unique-suffix>.s3.amazonaws.com/packaged.yml
  &stackName=codebreaker
  &param_JudgeName=mycontest
```

URL-encoded version:
```
https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?templateURL=https%3A%2F%2Fcodebreaker-templates-<your-unique-suffix>.s3.amazonaws.com%2Fpackaged.yml&stackName=codebreaker&param_JudgeName=mycontest
```

## Updating One-Click Deployment

```bash
sam package \
  --template-file template.yml \
  --output-template-file packaged.yml \
  --s3-bucket codebreaker-templates-<your-unique-suffix> \
  --s3-prefix templates

aws s3 cp packaged.yml s3://codebreaker-templates-<your-unique-suffix>/packaged.yml
```
