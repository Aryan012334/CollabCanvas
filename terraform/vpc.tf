# ============================================================
# vpc.tf
#
# WHAT: Creates the network that everything runs inside.
#
# A VPC (Virtual Private Cloud) is your own isolated section
# of the AWS network. Think of it as a private data center
# that only your resources can access.
#
# WHAT WE CREATE:
#   VPC              → the private network container
#   Public subnets   → where EKS nodes and the ALB live
#   Internet Gateway → allows traffic in/out of the VPC
#   Route table      → tells traffic how to reach the internet
#
# WHY ONLY PUBLIC SUBNETS?
#   Private subnets require a NAT Gateway (~$32/month extra).
#   For a student project, public subnets are fine.
#   In production you'd add private subnets for the nodes.
#
# The special tags on subnets are REQUIRED by EKS and the
# AWS Load Balancer Controller to discover which subnets
# to use for the ALB.
# ============================================================

# ── Data source: get all availability zones in the region ──
# We spread subnets across 2 AZs for basic redundancy.
data "aws_availability_zones" "available" {
  state = "available"
}

# ── VPC ────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true   # required for EKS
  enable_dns_support   = true   # required for EKS

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

# ── Public Subnets ─────────────────────────────────────────
# We create 2 subnets in 2 different availability zones.
# EKS requires at least 2 AZs for high availability.
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true   # nodes get public IPs automatically

  tags = {
    Name    = "${var.project_name}-public-${count.index + 1}"
    Project = var.project_name

    # REQUIRED: tells EKS this subnet can be used for nodes
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"

    # REQUIRED: tells the AWS Load Balancer Controller to
    # create internet-facing ALBs in these subnets
    "kubernetes.io/role/elb" = "1"
  }
}

# ── Internet Gateway ───────────────────────────────────────
# Connects the VPC to the internet.
# Without this, nothing in the VPC can reach the internet
# and nothing from the internet can reach the VPC.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name    = "${var.project_name}-igw"
    Project = var.project_name
  }
}

# ── Route Table ────────────────────────────────────────────
# Tells traffic: "to reach the internet (0.0.0.0/0),
# go through the internet gateway"
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name    = "${var.project_name}-rt-public"
    Project = var.project_name
  }
}

# ── Associate route table with each public subnet ──────────
resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Security Group for EKS nodes ───────────────────────────
# Controls what traffic is allowed in/out of the worker nodes.
# EKS manages most of its own security groups, but we create
# one for the node group to allow all outbound traffic.
resource "aws_security_group" "node_group" {
  name        = "${var.project_name}-node-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = aws_vpc.main.id

  # Allow all outbound traffic (nodes need to pull images,
  # call AWS APIs, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name    = "${var.project_name}-node-sg"
    Project = var.project_name
  }
}
