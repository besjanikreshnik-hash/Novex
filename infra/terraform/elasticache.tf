# =============================================================================
# NovEx Infrastructure — ElastiCache Redis
# =============================================================================
# Dev/staging: single-node ElastiCache cluster (cost-effective).
# Prod: replication group with automatic failover across AZs.
# Encryption at rest and in transit enabled for all environments.
# =============================================================================

# -----------------------------------------------------------------------------
# Subnet Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-redis-subnet-group" }
}

# -----------------------------------------------------------------------------
# Security Group — only ECS tasks may connect
# -----------------------------------------------------------------------------

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  description = "Allow Redis access from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-redis-sg" }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Single-node cluster for dev/staging
# -----------------------------------------------------------------------------

resource "aws_elasticache_cluster" "main" {
  count = var.environment != "prod" ? 1 : 0

  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Maintenance
  maintenance_window = "sun:05:00-sun:06:00"

  tags = { Name = "${local.name_prefix}-redis" }
}

# -----------------------------------------------------------------------------
# Replication group for prod (automatic failover, 2 replicas)
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  count = var.environment == "prod" ? 1 : 0

  replication_group_id = "${local.name_prefix}-redis"
  description          = "NovEx prod Redis cluster with failover"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  parameter_group_name = "default.redis7"
  port                 = 6379

  # 1 primary + 1 replica across AZs
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Maintenance
  maintenance_window = "sun:05:00-sun:06:00"

  tags = { Name = "${local.name_prefix}-redis" }
}
