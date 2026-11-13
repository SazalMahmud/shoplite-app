terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket         = "shoplite-tfstate-850995533893"
    key            = "shoplite/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "shoplite-tf-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = "ap-southeast-1"
  default_tags {
    tags = { project = "shoplite" }
  }
}

module "network" {
  source               = "./modules/network"
  name                 = "shoplite"
  vpc_cidr             = "10.0.0.0/16"
  azs                  = ["ap-southeast-1a", "ap-southeast-1b"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]
}

output "vpc_id" { value = module.network.vpc_id }
output "public_subnet_ids" { value = module.network.public_subnet_ids }
output "private_subnet_ids" { value = module.network.private_subnet_ids }
