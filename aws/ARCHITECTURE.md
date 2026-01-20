# Fuelio AWS Architecture

## Overview

Fuelio deploys on AWS using containerized architecture with managed services.

## Architecture

```
Internet
   |
   v
Application Load Balancer (Port 80)
   |
   v
ECS Fargate Tasks (Containers)
   |-- Frontend (Nginx, Port 80)
   |-- Backend (FastAPI, Port 8000)
   |
   v
RDS PostgreSQL Database (Port 5432)
```

## AWS Services

- **ECS Fargate**: Serverless container hosting
- **RDS PostgreSQL**: Managed database
- **ECR**: Container registry
- **CloudWatch**: Logging and monitoring
- **Application Load Balancer**: Traffic distribution
- **VPC**: Network isolation

## Infrastructure as Code

All infrastructure defined in `aws/infrastructure.yaml` using CloudFormation.

## Security

- Database in private subnets
- Security groups restrict access
- Least-privilege IAM roles

## Resume Skills

- AWS cloud deployment (ECS, RDS, ECR, CloudWatch)
- Infrastructure as Code (CloudFormation)
- Docker containerization
- Cloud architecture design
