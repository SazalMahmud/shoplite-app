variable "repositories" { type = list(string) }

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.repositories)
  name                 = each.value
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

output "repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}
