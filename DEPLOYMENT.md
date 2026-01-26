# AWS Deployment Guide

## Prerequisites

1. AWS account (free tier available)
2. Install AWS CLI:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws configure
```
3. Install envsubst:
```bash
sudo apt-get install gettext-base
```

## Deployment Steps

### Step 1: Update Environment Variables

Edit `.env.production`:

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=YOUR_12_DIGIT_AWS_ACCOUNT_ID
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_USER=postgres
DB_PASSWORD=your-secure-password
SECRET_KEY=your-random-32-character-string
```

Find AWS Account ID: AWS Console → Click your name (top right) → Copy 12-digit number

### Step 2: Create Infrastructure

```bash
aws cloudformation create-stack \
    --stack-name fuelio-infrastructure \
    --template-body file://aws/infrastructure.yaml \
    --parameters \
        ParameterKey=DBPassword,ParameterValue=YOUR_PASSWORD \
        ParameterKey=SecretKey,ParameterValue=YOUR_SECRET \
    --capabilities CAPABILITY_IAM \
    --region us-east-1

aws cloudformation wait stack-create-complete --stack-name fuelio-infrastructure --region us-east-1
```

Get database endpoint:
```bash
aws cloudformation describe-stacks \
    --stack-name fuelio-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text \
    --region us-east-1
```

Update `DB_HOST` in `.env.production` with this endpoint.

### Step 3: Deploy Application

```bash
./aws/deploy.sh
```

### Step 4: Get Application URL

```bash
aws cloudformation describe-stacks \
    --stack-name fuelio-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
    --output text \
    --region us-east-1
```

Open this URL in your browser.

## Update Application

```bash
./aws/deploy.sh
```

## Monitoring

View logs:
```bash
aws logs tail /ecs/fuelio-backend --follow --region us-east-1
aws logs tail /ecs/fuelio-frontend --follow --region us-east-1
```

Check service status:
```bash
aws ecs describe-services --cluster fuelio-cluster --services fuelio-service --region us-east-1
```

