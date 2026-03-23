# =============================================================================
# NovEx Infrastructure — Main Configuration
# =============================================================================
# Root Terraform config for the NovEx platform on AWS.
# Architecture: ECS Fargate + RDS PostgreSQL + ElastiCache Redis + ALB
#
# File layout:
#   main.tf          — Provider, backend, data sources, locals
#   variables.tf     — Input variables
#   vpc.tf           — Networking (VPC, subnets, gateways, routes)
#   rds.tf           — PostgreSQL database
#   elasticache.tf   — Redis cache
#   ecr.tf           — Container registries
#   ecs.tf           — ECS Fargate cluster, tasks, services, autoscaling
#   alb.tf           — Application Load Balancer, listeners, target groups
#   s3.tf            — S3 buckets (assets, backups)
#   cloudwatch.tf    — Monitoring dashboard, alarms, SNS
#   outputs.tf       — Exported values
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state with S3 + DynamoDB locking.
  # Bootstrap: create the bucket and table first (see s3.tf), then migrate.
  backend "s3" {
    bucket         = "novex-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "novex-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ACM certificates for CloudFront must live in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Data sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# Locals
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)
  account_id  = data.aws_caller_identity.current.account_id

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
