terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = "ap-southeast-1"
  default_tags {
    tags = { project = "shoplite" }
  }
}

data "aws_caller_identity" "me" {}

resource "aws_s3_bucket" "state" {
  bucket = "shoplite-tfstate-${data.aws_caller_identity.me.account_id}"
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_dynamodb_table" "lock" {
  name         = "shoplite-tf-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}

output "bucket" { value = aws_s3_bucket.state.id }
output "lock_table" { value = aws_dynamodb_table.lock.name }
