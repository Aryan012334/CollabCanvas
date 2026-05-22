# ============================================================
# variables.tf
#
# WHAT: Defines all the input variables for this Terraform
#       setup. Think of these as the "settings" you can
#       change without touching the main code.
#
# WHY:  Instead of hardcoding "us-east-1" everywhere, we
#       define it once here. Change it here → changes
#       everywhere automatically.
#
# Values are set in terraform.tfvars (your local file,
# never committed to Git).
# ============================================================

variable "aws_region" {
  description = "AWS region to deploy everything into"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "collabdraw-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.30"
}

variable "node_instance_type" {
  description = "EC2 instance type for worker nodes. t3.medium = 2 vCPU, 4GB RAM. Good for a student project."
  type        = string
  default     = "t3.medium"
}

variable "node_min" {
  description = "Minimum number of worker nodes (scale down to save cost)"
  type        = number
  default     = 1
}

variable "node_max" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 3
}

variable "node_desired" {
  description = "Desired number of worker nodes at startup"
  type        = number
  default     = 2
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC (the private IP address range)"
  type        = string
  default     = "10.0.0.0/16"
}

variable "project_name" {
  description = "Project name — used as a prefix on all AWS resource names"
  type        = string
  default     = "collabdraw"
}
