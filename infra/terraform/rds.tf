# =============================================================================
# NovEx Infrastructure — RDS PostgreSQL
# =============================================================================
# PostgreSQL 16 in private subnets. Multi-AZ in prod for failover.
# Automated backups retained for 7 days (dev) or 30 days (prod).
# Only ECS tasks can reach port 5432.
# =============================================================================

# -----------------------------------------------------------------------------
# Subnet Group — places the instance in private subnets
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-db-subnet-group" }
}

# -----------------------------------------------------------------------------
# Security Group — only ECS tasks may connect
# -----------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  description = "Allow PostgreSQL access from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-rds-sg" }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# RDS Instance
# -----------------------------------------------------------------------------

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = var.environment == "prod" ? 200 : 50   # autoscaling cap
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "novex"
  username = "novex_admin"
  password = var.db_password

  # Networking
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # High availability — Multi-AZ only in prod
  multi_az = var.environment == "prod"

  # Backups
  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance
  performance_insights_enabled = true

  # Protection
  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-final-snapshot" : null

  # Apply changes during maintenance window in prod
  apply_immediately = var.environment != "prod"

  tags = { Name = "${local.name_prefix}-postgres" }
}
