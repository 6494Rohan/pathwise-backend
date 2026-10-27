output "db_host" {
  value = aws_db_instance.main.address
}

output "db_name" {
  value = aws_db_instance.main.db_name
}

output "db_user" {
  value = aws_db_instance.main.username
}

output "db_password_ssm_parameter" {
  description = "Read with: aws ssm get-parameter --with-decryption --name <this>"
  value       = aws_ssm_parameter.db_password.name
}
