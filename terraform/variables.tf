variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "pathwise"
}

variable "stage" {
  type    = string
  default = "dev"
}

variable "allowed_cidrs" {
  description = "Developer IPs (CIDR) allowed to reach PostgreSQL directly, e.g. for Alembic. Lambdas are allowed through their security group."
  type        = list(string)
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_engine_version" {
  type    = string
  default = "17.11"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}
