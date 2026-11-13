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

module "ecr" {
  source       = "./modules/ecr"
  repositories = ["shoplite/web", "shoplite/catalog-api", "shoplite/order-worker"]
}

output "ecr_repository_urls" { value = module.ecr.repository_urls }

module "compute" {
  source             = "./modules/compute"
  name               = "shoplite"
  vpc_id             = module.network.vpc_id
  vpc_cidr           = module.network.vpc_cidr
  private_subnet_ids = module.network.private_subnet_ids
  instance_type      = "t3.medium"
  worker_count       = 2
}

output "control_plane_id" { value = module.compute.control_plane_id }
output "worker_ids" { value = module.compute.worker_ids }

module "alb" {
  source              = "./modules/alb"
  name                = "shoplite"
  vpc_id              = module.network.vpc_id
  public_subnet_ids   = module.network.public_subnet_ids
  target_instance_ids = module.compute.worker_ids
  target_port         = 30080
}

output "alb_dns_name" { value = module.alb.alb_dns_name }
