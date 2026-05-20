# ============================================================
# provider.tf
#
# WHAT: Tells Terraform which cloud provider to use and
#       which version of the AWS provider to download.
#
# WHY:  Terraform is provider-agnostic — it works with AWS,
#       Azure, GCP, etc. This file locks us to AWS.
#
# The "required_version" line ensures everyone on the team
# uses the same Terraform CLI version (avoids surprises).
# ============================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # kubernetes provider — used to install the AWS Load Balancer
    # Controller into EKS after the cluster is created
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Configure the AWS provider.
# Region is read from variables.tf so it's easy to change.
provider "aws" {
  region = var.aws_region
}

# Configure the Kubernetes provider to talk to our EKS cluster.
# It reads the cluster endpoint and auth token from the EKS
# resource we create in eks.tf.
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks", "get-token",
      "--cluster-name", module.eks.cluster_name,
      "--region", var.aws_region
    ]
  }
}
