# =============================================================================
# NovEx Infrastructure — Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

# -----------------------------------------------------------------------------
# Load Balancer
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "ALB DNS name — point your domain CNAME here"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (for Route 53 alias records)"
  value       = aws_lb.main.zone_id
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS PostgreSQL hostname"
  value       = aws_db_instance.main.address
}

# -----------------------------------------------------------------------------
# Cache
# -----------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value = var.environment == "prod" ? (
    aws_elasticache_replication_group.main[0].primary_endpoint_address
  ) : (
    aws_elasticache_cluster.main[0].cache_nodes[0].address
  )
}

# -----------------------------------------------------------------------------
# Container Registry
# -----------------------------------------------------------------------------

output "ecr_backend_url" {
  description = "ECR repository URL for novex-backend"
  value       = aws_ecr_repository.app["novex-backend"].repository_url
}

output "ecr_web_url" {
  description = "ECR repository URL for novex-web"
  value       = aws_ecr_repository.app["novex-web"].repository_url
}

output "ecr_admin_url" {
  description = "ECR repository URL for novex-admin"
  value       = aws_ecr_repository.app["novex-admin"].repository_url
}

# -----------------------------------------------------------------------------
# ECS
# -----------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

# -----------------------------------------------------------------------------
# S3
# -----------------------------------------------------------------------------

output "s3_assets_bucket" {
  description = "S3 bucket for static assets and uploads"
  value       = aws_s3_bucket.assets.id
}

output "s3_backups_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.id
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  value       = aws_sns_topic.alerts.arn
}

output "cloudwatch_dashboard_url" {
  description = "Direct link to the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}
