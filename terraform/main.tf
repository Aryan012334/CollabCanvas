# ============================================================
# main.tf
#
# WHAT: The entry point of the Terraform configuration.
#       Ties everything together and creates resources that
#       don't fit neatly into vpc.tf or eks.tf.
#
# In this project:
#   vpc.tf  → network (VPC, subnets, internet gateway)
#   eks.tf  → cluster (EKS, node group, IAM for ALB)
#   main.tf → ECR repositories (Docker image storage)
#
# WHY ECR?
#   EKS needs to pull your Docker images from somewhere.
#   ECR (Elastic Container Registry) is AWS's private
#   Docker registry. It's in the same AWS account so
#   EKS can pull images without extra authentication.
# ============================================================

# ── ECR Repositories ───────────────────────────────────────
# One repository per service. Each repo stores all versions
# (tags) of that service's Docker image.

resource "aws_ecr_repository" "http_backend" {
  name                 = "${var.project_name}-http"
  image_tag_mutability = "MUTABLE"   # allows overwriting :latest tag

  image_scanning_configuration {
    scan_on_push = true   # automatically scan for vulnerabilities
  }

  tags = {
    Project = var.project_name
    Service = "http-backend"
  }
}

resource "aws_ecr_repository" "ws_server" {
  name                 = "${var.project_name}-ws"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = var.project_name
    Service = "ws-server"
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = var.project_name
    Service = "frontend"
  }
}

# ── ECR Lifecycle Policy ───────────────────────────────────
# Automatically delete old images to save storage costs.
# Keeps only the 10 most recent images per repository.
# Without this, old images accumulate and you pay for storage.

resource "aws_ecr_lifecycle_policy" "http_backend" {
  repository = aws_ecr_repository.http_backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "ws_server" {
  repository = aws_ecr_repository.ws_server.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
