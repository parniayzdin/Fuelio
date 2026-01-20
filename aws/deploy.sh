#!/bin/bash
set -e

echo "Fuelio AWS Deployment"
echo ""

if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "Error: .env.production file not found!"
    exit 1
fi

required_vars=("AWS_REGION" "AWS_ACCOUNT_ID" "DB_HOST" "DB_USER" "DB_PASSWORD" "SECRET_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in .env.production"
        exit 1
    fi
done

echo "Environment variables loaded"
echo ""

echo "Step 1/5: Logging into AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
echo "Logged into ECR"
echo ""

echo "Step 2/5: Creating ECR repositories..."
aws ecr describe-repositories --repository-names fuelio-backend --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name fuelio-backend --region $AWS_REGION
    
aws ecr describe-repositories --repository-names fuelio-frontend --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name fuelio-frontend --region $AWS_REGION
echo "ECR repositories ready"
echo ""

echo "Step 3/5: Building Docker images..."
docker build -f Dockerfile.backend -t fuelio-backend:latest .
docker build -f Dockerfile.frontend -t fuelio-frontend:latest .
echo "Images built"
echo ""

echo "Step 4/5: Pushing images to ECR..."
docker tag fuelio-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fuelio-backend:latest
docker tag fuelio-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fuelio-frontend:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fuelio-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fuelio-frontend:latest
echo "Images pushed to ECR"
echo ""

echo "Step 5/5: Updating ECS service..."
envsubst < aws/ecs-task-definition.json > /tmp/ecs-task-definition.json

aws ecs register-task-definition \
    --cli-input-json file:///tmp/ecs-task-definition.json \
    --region $AWS_REGION

if aws ecs describe-services --cluster fuelio-cluster --services fuelio-service --region $AWS_REGION 2>/dev/null | grep -q "ACTIVE"; then
    aws ecs update-service \
        --cluster fuelio-cluster \
        --service fuelio-service \
        --task-definition fuelio-app \
        --force-new-deployment \
        --region $AWS_REGION
    echo "ECS service updated"
else
    echo "Note: ECS service not found. Create it first using CloudFormation"
fi

echo ""
echo "Deployment Complete"