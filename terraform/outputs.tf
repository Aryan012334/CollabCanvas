# ============================================================
# outputs.tf
#
# WHAT: Prints useful values after "terraform apply" finishes.
#
# WHY:  After Terraform creates everything, you need certain
#       values to continue — like the cluster name to run
#       kubectl, or the ECR URLs to push Docker images.
#       Outputs print these automatically so you don't have
#       to dig through the AWS console.
#
# Usage:
#   terraform output                    # show all outputs
#   terraform output cluster_name       # show one value
#   terraform output -raw ecr_http_url  # raw value (no quotes)
# ============================================================

# ── EKS Cluster ────────────────────────────────────────────

output "cluster_name" {
  description = "EKS cluster name — use this in the kubectl config command"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint — where kubectl sends commands"
  value       = module.eks.cluster_endpoint
}

output "cluster_region" {
  description = "AWS region the cluster is in"
  value       = var.aws_region
}

output "kubectl_config_command" {
  description = "Run this command to configure kubectl to talk to your EKS cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# ── ECR Repositories ───────────────────────────────────────

output "ecr_http_url" {
  description = "ECR URL for the http-backend image — use this in your Dockerfile push commands"
  value       = aws_ecr_repository.http_backend.repository_url
}

output "ecr_ws_url" {
  description = "ECR URL for the ws-server image"
  value       = aws_ecr_repository.ws_server.repository_url
}

output "ecr_web_url" {
  description = "ECR URL for the frontend image"
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_login_command" {
  description = "Run this to authenticate Docker with ECR before pushing images"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${split("/", aws_ecr_repository.http_backend.repository_url)[0]}"
}

# ── VPC ────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID — useful for debugging network issues"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs — where EKS nodes and the ALB run"
  value       = aws_subnet.public[*].id
}

# ── ALB Controller IAM Role ────────────────────────────────

output "alb_controller_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller"
  value       = aws_iam_role.alb_controller.arn
}

# ── Next steps summary ─────────────────────────────────────

output "next_steps" {
  description = "What to do after terraform apply"
  value       = <<-EOT

    ============================================================
    NEXT STEPS
    ============================================================

    1. Configure kubectl:
       aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}

    2. Install AWS Load Balancer Controller:
       helm repo add eks https://aws.github.io/eks-charts
       helm repo update
       helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
         -n kube-system \
         --set clusterName=${module.eks.cluster_name} \
         --set serviceAccount.create=false \
         --set serviceAccount.name=aws-load-balancer-controller

    3. Push Docker images to ECR:
       ${split("/", aws_ecr_repository.http_backend.repository_url)[0]}

    4. Update k8s deployment YAMLs with ECR image URLs

    5. Deploy the app:
       kubectl apply -f k8s/

    ============================================================
  EOT
}
