# The Serverless API reads these at deploy time (serverless.yml → ${ssm:...}).
locals {
  ssm_prefix = "/${var.project}/${var.stage}"
}

resource "aws_ssm_parameter" "db_host" {
  name  = "${local.ssm_prefix}/db/host"
  type  = "String"
  value = aws_db_instance.main.address
}

resource "aws_ssm_parameter" "db_name" {
  name  = "${local.ssm_prefix}/db/name"
  type  = "String"
  value = aws_db_instance.main.db_name
}

resource "aws_ssm_parameter" "db_user" {
  name  = "${local.ssm_prefix}/db/user"
  type  = "String"
  value = aws_db_instance.main.username
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${local.ssm_prefix}/db/password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "lambda_security_group_id" {
  name  = "${local.ssm_prefix}/lambda/security-group-id"
  type  = "String"
  value = aws_security_group.lambda.id
}

resource "aws_ssm_parameter" "subnet_ids" {
  name  = "${local.ssm_prefix}/vpc/subnet-ids"
  type  = "StringList"
  value = join(",", aws_subnet.public[*].id)
}
