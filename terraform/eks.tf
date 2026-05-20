# ============================================================
# eks.tf
#
# WHAT: Creates the EKS cluster and the worker nodes.
#
# EKS has two parts:
#   1. Control plane — the Kubernetes "brain" (AWS manages this)
#      Handles scheduling, API server, etcd database
#
#   2. Node group — the EC2 machines that run your pods
#      These are regular EC2 instances you pay for
#
# We use the official AWS EKS Terraform module because it
# handles all the complex IAM roles and policies that EKS
# requires. Writing them manually would be 200+ lines.
#
# MODULE SOURCE: https://registry.terraform.io/modules/terraform-aws-modules/eks/aws
# ============================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  # ── Cluster basics ────────────────────────────────────────
  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  # ── Networking ────────────────────────────────────────────
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.public[*].id

  # Allow your local machine to talk to the Kubernetes API.
  # "true" means the API server is reachable from the internet
  # (required for kubectl from your laptop).
  cluster_endpoint_public_access = true

  # ── Worker nodes ──────────────────────────────────────────
  # A "managed node group" means AWS handles OS updates and
  # node replacement for you. You just specify the instance type.
  eks_managed_node_groups = {
    main = {
      name = "${var.project_name}-nodes"

      instance_types = [var.node_instance_type]

      min_size     = var.node_min
      max_size     = var.node_max
      desired_size = var.node_desired

      # Amazon Linux 2 — the standard EKS node OS
      ami_type = "AL2_x86_64"

      # Attach our security group to the nodes
      vpc_security_group_ids = [aws_security_group.node_group.id]

      labels = {
        Project = var.project_name
      }
    }
  }

  # ── Access ────────────────────────────────────────────────
  # This gives the IAM user/role running Terraform full
  # admin access to the cluster via kubectl.
  enable_cluster_creator_admin_permissions = true

  tags = {
    Project = var.project_name
  }
}

# ── IAM Role for AWS Load Balancer Controller ──────────────
# The ALB Controller runs inside Kubernetes but needs
# permission to create/manage AWS ALBs on your behalf.
# This is called IRSA (IAM Roles for Service Accounts).
#
# HOW IT WORKS:
#   1. We create an IAM role with ALB permissions
#   2. We attach it to the Kubernetes service account
#   3. The ALB Controller pod uses that service account
#   4. AWS lets the pod create ALBs because of the role
resource "aws_iam_role" "alb_controller" {
  name = "${var.project_name}-alb-controller"

  # Trust policy: allows the EKS OIDC provider to assume this role
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = module.eks.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${module.eks.oidc_provider}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
          "${module.eks.oidc_provider}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = {
    Project = var.project_name
  }
}

# Attach the AWS-managed ALB Controller policy to the role.
# This policy allows creating/updating/deleting ALBs, target
# groups, listeners, and security groups.
resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = aws_iam_role.alb_controller.name
  policy_arn = "arn:aws:iam::aws:policy/AWSLoadBalancerControllerIAMPolicy"
}

# ── Kubernetes Service Account for ALB Controller ──────────
# This is the Kubernetes side of IRSA.
# The annotation links this service account to the IAM role above.
resource "kubernetes_service_account" "alb_controller" {
  metadata {
    name      = "aws-load-balancer-controller"
    namespace = "kube-system"

    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.alb_controller.arn
    }

    labels = {
      "app.kubernetes.io/name"      = "aws-load-balancer-controller"
      "app.kubernetes.io/component" = "controller"
    }
  }

  depends_on = [module.eks]
}
