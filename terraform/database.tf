resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-postgres17"
  family = "postgres17"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

# Demo sizing: smallest instance, single AZ, 1-day backups, no final snapshot. Raise these before real users arrive.
resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = var.project
  username = "pathwise_admin"
  password = random_password.db.result
  port     = 5432

  allocated_storage = var.db_allocated_storage_gb
  storage_type      = "gp3"
  storage_encrypted = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = true
  multi_az               = false

  backup_retention_period      = 1
  skip_final_snapshot          = true
  deletion_protection          = false
  performance_insights_enabled = false
  monitoring_interval          = 0
  auto_minor_version_upgrade   = true
  apply_immediately            = true
}
