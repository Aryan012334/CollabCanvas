# Cloud Computing and DevOps - Complete Notes

---

## Unit I: Introduction to Cloud and DevOps Fundamentals

---

### 1. Overview of Cloud Computing

Cloud computing is the delivery of computing services — servers, storage, databases, networking, software, analytics, and intelligence — over the internet ("the cloud") to offer faster innovation, flexible resources, and economies of scale.

#### Characteristics (NIST - 5 Essential Characteristics)

| Characteristic | Description |
|---|---|
| **On-demand Self-service** | Users can provision resources automatically without human interaction from the provider |
| **Broad Network Access** | Services are available over the network via standard mechanisms (phones, tablets, laptops) |
| **Resource Pooling** | Provider's resources are pooled to serve multiple consumers using multi-tenant model |
| **Rapid Elasticity** | Resources can be elastically provisioned and released to scale rapidly with demand |
| **Measured Service** | Resource usage is monitored, controlled, and reported — pay for what you use |

#### Roots of Cloud Computing

- **1960s** – John McCarthy proposed "computation may someday be organized as a public utility"
- **1990s** – Telecommunications companies offered VPN services; Salesforce launched SaaS (1999)
- **2002** – Amazon Web Services launched storage/computation services
- **2006** – AWS launched EC2 and S3 — the modern cloud era began
- **2008** – Google App Engine, Microsoft Azure announced
- Cloud evolved from: **Mainframes → Client-Server → Grid Computing → Utility Computing → Cloud**

#### Delivery Models (Service Models)

```
┌─────────────────────────────────────────────┐
│                  SaaS                        │  ← Gmail, Salesforce, Office 365
│   (Software as a Service)                   │
├─────────────────────────────────────────────┤
│                  PaaS                        │  ← Heroku, Google App Engine, AWS Elastic Beanstalk
│   (Platform as a Service)                   │
├─────────────────────────────────────────────┤
│                  IaaS                        │  ← AWS EC2, Azure VMs, GCP   Compute Engine
│   (Infrastructure as a Service)             │
└─────────────────────────────────────────────┘
```

**IaaS (Infrastructure as a Service)**
- Provides virtualized computing resources over the internet
- You manage: OS, runtime, middleware, applications, data
- Provider manages: Virtualization, servers, storage, networking
- Examples: AWS EC2, Azure Virtual Machines, GCP Compute Engine, DigitalOcean

**PaaS (Platform as a Service)**
- Provides a platform for developers to build, run, and manage applications
- You manage: Applications and data
- Provider manages: Runtime, middleware, OS, virtualization, servers, storage, networking
- Examples: Heroku, Google App Engine, AWS Elastic Beanstalk, Azure App Service

**SaaS (Software as a Service)**
- Delivers software applications over the internet on a subscription basis
- You manage: Nothing (just use the software)
- Provider manages: Everything
- Examples: Gmail, Microsoft 365, Salesforce, Dropbox, Zoom

---

### 2. Cloud Deployment Models

#### Public Cloud
- Infrastructure owned and operated by a third-party cloud provider
- Resources shared among multiple organizations (multi-tenant)
- **Pros:** Low cost, no maintenance, near-unlimited scalability, high reliability
- **Cons:** Less security/privacy, limited control, compliance challenges
- Examples: AWS, Microsoft Azure, Google Cloud Platform

#### Private Cloud
- Cloud infrastructure operated solely for a single organization
- Can be managed internally or by a third party, on-premises or off-premises
- **Pros:** Greater security and privacy, more control, compliance-friendly
- **Cons:** High cost, requires IT expertise, limited scalability
- Examples: VMware vSphere, OpenStack, Microsoft Azure Stack

#### Hybrid Cloud
- Combination of public and private clouds bound together by technology
- Allows data and applications to move between environments
- **Pros:** Flexibility, optimized cost, better security for sensitive data
- **Cons:** Complex to manage, networking challenges, potential latency
- Examples: AWS Outposts, Azure Arc, Google Anthos

#### Community Cloud
- Shared infrastructure for a specific community with common concerns (security, compliance, jurisdiction)
- Managed by organizations or a third party
- **Pros:** Cost-sharing, meets specific community needs, collaborative
- **Cons:** Less flexibility, limited customization per organization
- Examples: Government clouds, healthcare clouds (sharing compliance requirements)

```
Comparison Summary:
┌──────────────┬───────────┬───────────┬───────────┬───────────┐
│              │  Public   │  Private  │  Hybrid   │ Community │
├──────────────┼───────────┼───────────┼───────────┼───────────┤
│ Cost         │   Low     │   High    │  Medium   │  Medium   │
│ Security     │  Medium   │   High    │   High    │   High    │
│ Scalability  │   High    │  Medium   │   High    │  Medium   │
│ Control      │   Low     │   High    │  Medium   │  Medium   │
│ Compliance   │  Medium   │   High    │   High    │   High    │
└──────────────┴───────────┴───────────┴───────────┴───────────┘
```

---

### 3. Introduction to DevOps

DevOps is a set of practices, cultural philosophies, and tools that combines software development (Dev) and IT operations (Ops) to shorten the development lifecycle and deliver high-quality software continuously.

#### Market Trends
- DevOps market size was ~$10.4 billion in 2023, projected to reach $25+ billion by 2028
- 63% of organizations have adopted DevOps practices (2024 reports)
- Key trends:
  - **DevSecOps** – Security integrated into DevOps pipelines
  - **GitOps** – Git as the single source of truth for infrastructure
  - **AIOps** – AI-driven operations and monitoring
  - **Platform Engineering** – Internal developer platforms (IDPs)
  - **Shift-Left Testing** – Testing earlier in the SDLC

#### Delivery Pipelines

A DevOps delivery pipeline automates the journey from code commit to production:

```
Developer → Source Control → Build → Test → Stage → Deploy → Monitor
    │              │           │       │       │        │         │
   Git          GitHub/     Maven/  JUnit/ Docker/ Kubernetes Prometheus/
  commit        GitLab      npm     Jest   Helm    ArgoCD     Grafana
```

**Stages of a Delivery Pipeline:**
1. **Source** – Code pushed to version control (Git)
2. **Build** – Compile code, resolve dependencies
3. **Test** – Unit tests, integration tests, code quality checks
4. **Package** – Create artifacts (Docker images, JARs)
5. **Deploy to Staging** – Deploy in a staging environment
6. **Acceptance Tests** – End-to-end, performance, security tests
7. **Deploy to Production** – Blue-green, canary, or rolling deployment
8. **Monitor** – Observe metrics, logs, and alerts

#### DevOps Engineer Skills

**Technical Skills:**
- Version control (Git, GitHub, GitLab)
- CI/CD tools (Jenkins, GitHub Actions, GitLab CI, CircleCI)
- Containerization (Docker, Podman)
- Container orchestration (Kubernetes, OpenShift)
- Infrastructure as Code (Terraform, Ansible, CloudFormation)
- Cloud platforms (AWS, Azure, GCP)
- Scripting (Bash, Python, PowerShell)
- Monitoring (Prometheus, Grafana, ELK Stack)

**Soft Skills:**
- Collaboration and communication
- Systems thinking
- Problem-solving mindset
- Continuous learning attitude

---

### 4. Basics of Git

Git is a distributed version control system that tracks changes in source code during software development.

#### Git Lifecycle

```
Working Directory → Staging Area → Local Repository → Remote Repository
      │                  │                │                  │
   (edit files)      git add          git commit          git push
                                                         git pull/fetch
```

**File States in Git:**
- **Untracked** – New files Git doesn't know about
- **Modified** – Changed files not yet staged
- **Staged** – Files marked to be included in next commit
- **Committed** – Files safely stored in local database

#### Essential Git Commands

```bash
# Configuration
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# Initialize & Clone
git init                          # Initialize new repo
git clone <url>                   # Clone remote repo

# Basic Workflow
git status                        # Check working tree status
git add <file>                    # Stage specific file
git add .                         # Stage all changes
git commit -m "message"           # Commit staged changes
git log                           # View commit history
git log --oneline --graph         # Compact visual log

# Branching
git branch                        # List branches
git branch <name>                 # Create branch
git checkout <name>               # Switch branch
git checkout -b <name>            # Create and switch
git merge <branch>                # Merge branch
git rebase <branch>               # Rebase onto branch
git branch -d <name>              # Delete branch

# Remote Operations
git remote add origin <url>       # Add remote
git push origin <branch>          # Push to remote
git pull origin <branch>          # Pull from remote
git fetch origin                  # Fetch without merging

# Undoing Changes
git restore <file>                # Discard working changes
git reset HEAD <file>             # Unstage file
git revert <commit>               # Revert a commit (safe)
git reset --hard <commit>         # Reset to commit (destructive)

# Stashing
git stash                         # Stash uncommitted changes
git stash pop                     # Apply and remove latest stash
git stash list                    # List all stashes
```

#### Remote Repositories

- **GitHub** – Most popular, Microsoft-owned, great for open source
- **GitLab** – Built-in CI/CD, can be self-hosted
- **Bitbucket** – Atlassian ecosystem integration
- **Azure DevOps Repos** – Microsoft Azure integration

**Branching Strategies:**
- **Git Flow** – main, develop, feature, release, hotfix branches
- **GitHub Flow** – Simple: main + feature branches + PRs
- **Trunk-Based Development** – Short-lived branches, frequent merges to main

---

## Unit II: Virtualization in Cloud — Virtualization, Containerization, and Infrastructure Management

---

### 1. Virtualization

Virtualization is the process of creating a software-based (virtual) version of computing resources — including servers, storage, networks, and operating systems.

#### How It Works
A **Hypervisor** sits between the hardware and virtual machines, allocating resources to each VM.

```
┌──────────────────────────────────────────────┐
│           Virtual Machine 1 (VM1)            │
│  ┌─────────────────┐  ┌────────────────────┐ │
│  │   Guest OS      │  │   Applications     │ │
│  └─────────────────┘  └────────────────────┘ │
├──────────────────────────────────────────────┤
│           Virtual Machine 2 (VM2)            │
├──────────────────────────────────────────────┤
│                  Hypervisor                  │
├──────────────────────────────────────────────┤
│         Host Hardware (CPU, RAM, Disk)       │
└──────────────────────────────────────────────┘
```

#### Types of Virtualization

| Type | Description | Examples |
|---|---|---|
| **Server Virtualization** | Multiple VMs on a single physical server | VMware ESXi, Hyper-V |
| **Desktop Virtualization** | Run desktop OS in a virtual environment | VDI, Citrix |
| **Storage Virtualization** | Abstract physical storage into logical pools | SAN, NAS |
| **Network Virtualization** | Create virtual networks over physical infrastructure | VLAN, SDN, NFV |
| **Application Virtualization** | Run apps in isolated environments | Docker, App-V |
| **OS-Level Virtualization** | Multiple isolated userspace instances | Containers (LXC) |

#### Hypervisors

**Type 1 (Bare-Metal Hypervisor):**
- Runs directly on the host hardware
- No underlying OS required
- Better performance, more secure
- Examples: VMware ESXi, Microsoft Hyper-V, Xen, KVM

**Type 2 (Hosted Hypervisor):**
- Runs on top of a host operating system
- Easier to set up, good for development
- Slight performance overhead
- Examples: VMware Workstation, VirtualBox, Parallels

```
Type 1:                          Type 2:
┌─────────────────┐              ┌─────────────────┐
│   VM1  │  VM2  │              │   VM1  │  VM2  │
├─────────────────┤              ├─────────────────┤
│    Hypervisor   │              │    Hypervisor   │
├─────────────────┤              ├─────────────────┤
│    Hardware     │              │    Host OS      │
└─────────────────┘              ├─────────────────┤
                                 │    Hardware     │
                                 └─────────────────┘
```

---

### 2. Containerization using Docker

Containers are lightweight, standalone, executable packages that include everything needed to run an application: code, runtime, libraries, and config.

#### Containers vs Virtual Machines

```
Virtual Machines:                Containers:
┌────────┬────────┐             ┌────────┬────────┐
│  App A │  App B │             │  App A │  App B │
│  Libs  │  Libs  │             │  Libs  │  Libs  │
│ Guest  │ Guest  │             ├────────┴────────┤
│  OS    │  OS    │             │  Container Runt.│
├────────┴────────┤             ├─────────────────┤
│   Hypervisor    │             │    Host OS      │
├─────────────────┤             ├─────────────────┤
│    Hardware     │             │    Hardware     │
└─────────────────┘             └─────────────────┘
Heavy (~GBs), Slow boot         Lightweight (~MBs), Fast start
```

#### Docker Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Client (CLI)                    │
│              docker build, run, pull, push               │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────────┐
│                    Docker Daemon (dockerd)                │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Images   │  │Containers│  │      Networks/Volumes  │ │
│  └──────────┘  └──────────┘  └────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                Docker Registry (Docker Hub)               │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- **Docker Client** – CLI tool to interact with Docker daemon
- **Docker Daemon (dockerd)** – Background service managing containers
- **Docker Images** – Read-only templates used to create containers
- **Docker Containers** – Running instances of images
- **Docker Registry** – Stores and distributes Docker images (Docker Hub, ECR, GCR)
- **Docker Volumes** – Persistent storage for containers
- **Docker Networks** – Communication between containers

#### Docker Lifecycle

```
Dockerfile → docker build → Image → docker run → Container
                                          │
                                    docker stop → Stopped Container
                                          │
                                    docker rm   → Deleted
```

#### Docker Images

A Docker image is a layered, read-only template built from a `Dockerfile`.

```dockerfile
# Example Dockerfile
FROM node:18-alpine          # Base image layer

WORKDIR /app                 # Set working directory

COPY package*.json ./        # Copy dependency files

RUN npm install              # Install dependencies (creates a layer)

COPY . .                     # Copy source code

EXPOSE 3000                  # Document the port

CMD ["node", "server.js"]    # Default command
```

**Docker Image Layers:**
- Each instruction in a Dockerfile creates a new layer
- Layers are cached and shared between images
- Only changed layers are rebuilt

**Essential Docker Commands:**

```bash
# Images
docker build -t myapp:1.0 .         # Build image from Dockerfile
docker images                        # List local images
docker pull nginx                    # Pull from registry
docker push myrepo/myapp:1.0        # Push to registry
docker rmi myapp:1.0                 # Remove image

# Containers
docker run -d -p 8080:80 nginx       # Run detached, map ports
docker run -it ubuntu bash           # Run interactive
docker run -v /host/path:/container/path myapp  # Mount volume
docker ps                            # List running containers
docker ps -a                         # List all containers
docker stop <id>                     # Stop container
docker start <id>                    # Start stopped container
docker rm <id>                       # Remove container
docker logs <id>                     # View logs
docker exec -it <id> bash            # Enter container shell
docker inspect <id>                  # Detailed container info

# Docker Compose
docker-compose up -d                 # Start services
docker-compose down                  # Stop and remove services
docker-compose ps                    # List services
docker-compose logs                  # View all logs
```

---

### 3. Container Orchestration using Kubernetes

Kubernetes (K8s) is an open-source container orchestration platform for automating deployment, scaling, and management of containerized applications.

#### Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Control Plane                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  API     │  │  etcd    │  │Scheduler │  │Controller │  │
│  │  Server  │  │          │  │          │  │  Manager  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                                   │
┌───────────▼──────────┐         ┌──────────────▼──────────┐
│       Worker Node 1  │         │      Worker Node 2       │
│  ┌────────────────┐  │         │  ┌────────────────────┐  │
│  │   Pod (App A)  │  │         │  │    Pod (App B)      │  │
│  └────────────────┘  │         │  └────────────────────┘  │
│  ┌────────┐          │         │  ┌────────┐              │
│  │kubelet │          │         │  │kubelet │              │
│  └────────┘          │         │  └────────┘              │
└──────────────────────┘         └─────────────────────────┘
```

**Control Plane Components:**
- **API Server** – Entry point for all K8s commands; exposes REST API
- **etcd** – Distributed key-value store; cluster state/config storage
- **Scheduler** – Assigns pods to nodes based on resource availability
- **Controller Manager** – Runs controllers (ReplicaSet, Deployment, etc.)
- **Cloud Controller Manager** – Integrates with cloud provider APIs

**Worker Node Components:**
- **kubelet** – Agent that ensures containers in pods are running
- **kube-proxy** – Manages network rules for pod communication
- **Container Runtime** – Docker, containerd, CRI-O

**Core Kubernetes Objects:**

```yaml
# Pod - smallest deployable unit
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: my-container
    image: nginx:latest
    ports:
    - containerPort: 80

---
# Deployment - manages ReplicaSets
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-container
        image: nginx:latest

---
# Service - exposes pods
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

**Essential kubectl Commands:**

```bash
kubectl get pods                          # List pods
kubectl get nodes                         # List nodes
kubectl get deployments                   # List deployments
kubectl apply -f deployment.yaml          # Apply manifest
kubectl delete -f deployment.yaml         # Delete resources
kubectl describe pod <name>               # Detailed pod info
kubectl logs <pod-name>                   # View pod logs
kubectl exec -it <pod> -- bash            # Shell into pod
kubectl scale deployment <name> --replicas=5  # Scale
kubectl rollout status deployment/<name>  # Check rollout
kubectl rollout undo deployment/<name>    # Rollback
```

---

### 4. Cloud Infrastructure Services

**Provisioning approaches:**
- **Manual (Console)** – Web-based GUI (AWS Console, GCP Console)
- **CLI** – AWS CLI, gcloud, az CLI
- **SDK** – Programmatic access via language-specific SDKs
- **Infrastructure as Code** – Terraform, CloudFormation, Pulumi

**Key AWS Infrastructure Services:**
- EC2 (compute), VPC (networking), S3 (storage), RDS (databases)
- IAM (identity), CloudWatch (monitoring), ELB (load balancing)

**Key GCP Infrastructure Services:**
- Compute Engine (VMs), GKE (Kubernetes), Cloud Storage, Cloud SQL
- Cloud IAM, Cloud Monitoring, Cloud Load Balancing

---

## Unit III: Infrastructure as Code (IaC) and Cloud Services

---

### 1. Infrastructure as Code (IaC)

IaC is the practice of managing and provisioning computing infrastructure through machine-readable configuration files rather than manual processes.

#### Principles

1. **Idempotency** – Running the same code multiple times produces the same result
2. **Declarative over Imperative** – Define *what* you want, not *how* to get there
3. **Version Control** – Infrastructure code lives in Git (versioned, reviewable)
4. **Immutability** – Replace rather than modify infrastructure
5. **Modularity** – Reusable modules/templates
6. **Automation** – Eliminate manual provisioning steps
7. **Documentation as Code** – Infrastructure code is self-documenting

#### IaC Approaches

| Approach | Description | Examples |
|---|---|---|
| **Declarative** | Define desired end state | Terraform, CloudFormation, Kubernetes YAML |
| **Imperative** | Define step-by-step instructions | Ansible (tasks), Chef, Puppet |
| **Mutable** | Modify existing infrastructure | Ansible, Chef |
| **Immutable** | Replace rather than modify | Terraform with replacement |

#### Terraform

HashiCorp Terraform is the most popular multi-cloud IaC tool using HCL (HashiCorp Configuration Language).

**Terraform Workflow:**

```
Write → Plan → Apply → Destroy
  │       │       │        │
 .tf     Review  Create  Remove
files   changes  infra   infra
```

**Terraform Commands:**

```bash
terraform init          # Initialize working directory, download providers
terraform plan          # Preview changes before applying
terraform apply         # Apply changes to create/update infrastructure
terraform destroy       # Destroy all managed infrastructure
terraform fmt           # Format configuration files
terraform validate      # Validate configuration syntax
terraform show          # Show current state
terraform state list    # List resources in state
terraform output        # Show output values
terraform import        # Import existing infrastructure
```

**Example Terraform Configuration:**

```hcl
# provider.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

# main.tf
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "main-vpc"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type
  
  tags = {
    Name = "web-server"
  }
}

# outputs.tf
output "instance_public_ip" {
  description = "Public IP of web server"
  value       = aws_instance.web.public_ip
}
```

**Terraform State:**
- Tracks the current state of managed infrastructure
- Stored in `terraform.tfstate` (locally or remote backend)
- Remote backends: S3+DynamoDB (AWS), Terraform Cloud, GCS

#### AWS CloudFormation

AWS-native IaC service using JSON or YAML templates.

```yaml
# Example CloudFormation Template
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Simple EC2 Instance'

Parameters:
  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues: [t3.micro, t3.small, t3.medium]

Resources:
  MyEC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: ami-0c55b159cbfafe1f0
      Tags:
        - Key: Name
          Value: MyInstance

Outputs:
  InstanceId:
    Description: Instance ID
    Value: !Ref MyEC2Instance
  PublicIP:
    Description: Public IP
    Value: !GetAtt MyEC2Instance.PublicIp
```

**CloudFormation vs Terraform:**

| Feature | Terraform | CloudFormation |
|---|---|---|
| Provider support | Multi-cloud | AWS only |
| Language | HCL | JSON/YAML |
| State management | Manual (remote backends) | AWS-managed |
| Rollback | Manual | Automatic |
| Community | Very large | AWS community |

---

### 2. Cloud Services

#### AWS EC2 (Elastic Compute Cloud)

- Virtual servers in the cloud
- **Instance Types:** General purpose (t3, m5), Compute optimized (c5), Memory optimized (r5), GPU (p3, g4)
- **Pricing Models:**
  - On-Demand – Pay per hour/second, no commitment
  - Reserved – 1 or 3 year commitment, up to 72% discount
  - Spot – Bid on spare capacity, up to 90% discount, can be interrupted
  - Savings Plans – Flexible pricing commitment

**EC2 Key Concepts:**
- **AMI (Amazon Machine Image)** – Template for launching instances
- **Security Groups** – Virtual firewall for instances
- **Key Pairs** – SSH access credentials
- **Elastic IP** – Static public IP address
- **Auto Scaling** – Automatically adjust capacity

#### AWS Lambda

- Serverless compute service — run code without managing servers
- Event-driven: triggers from S3, API Gateway, DynamoDB, SQS, etc.
- Supports Node.js, Python, Java, Go, Ruby, .NET
- Pricing: First 1M requests/month free, then $0.20 per 1M requests
- **Use cases:** API backends, data processing, scheduled tasks, event processing

```python
# Example Lambda Function
import json

def lambda_handler(event, context):
    print(f"Event: {event}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Hello from Lambda!',
            'input': event
        })
    }
```

#### AWS Elastic Beanstalk

- PaaS offering — deploy applications without managing infrastructure
- Supports: Node.js, Python, PHP, Java, .NET, Ruby, Go, Docker
- Automatically handles: Load balancing, auto-scaling, health monitoring, deployment
- Developer focus: Just upload code, Beanstalk handles the rest

**Deployment Policies:**
- **All at once** – Fast, but downtime
- **Rolling** – Updates batches, reduced capacity
- **Rolling with additional batch** – No capacity reduction
- **Immutable** – New instances, safest

#### GCP Services

| Service | AWS Equivalent | Description |
|---|---|---|
| Compute Engine | EC2 | Virtual machines |
| Google Kubernetes Engine (GKE) | EKS | Managed Kubernetes |
| Cloud Functions | Lambda | Serverless functions |
| App Engine | Elastic Beanstalk | PaaS for applications |
| Cloud Storage | S3 | Object storage |
| Cloud SQL | RDS | Managed relational DB |
| BigQuery | Redshift | Data warehouse |
| Cloud Run | Fargate | Serverless containers |
| Pub/Sub | SNS/SQS | Messaging service |
| Cloud IAM | IAM | Identity & access management |

#### OpenStack Components

OpenStack is an open-source cloud platform for building private/public clouds.

| Component | Code Name | Function |
|---|---|---|
| Compute | Nova | Manages virtual machines |
| Object Storage | Swift | Stores unstructured data |
| Block Storage | Cinder | Persistent storage volumes |
| Networking | Neutron | Network as a service |
| Image Service | Glance | Virtual machine images |
| Identity | Keystone | Authentication/Authorization |
| Dashboard | Horizon | Web UI |
| Orchestration | Heat | IaC/stack templates |
| Telemetry | Ceilometer | Metering and monitoring |

---

### 3. Cloud Economics

#### Pricing Fundamentals

**Pay-as-you-go Model:**
- Pay only for what you consume
- No upfront investment for most services
- Pricing dimensions: compute time, storage GB, data transfer, API calls

**AWS Pricing Factors:**
1. **Compute** – Instance type, region, OS, tenancy
2. **Storage** – GB stored, storage class, retrieval fees
3. **Data Transfer** – Inbound (usually free), outbound charges apply
4. **Managed Services** – Additional charges over raw infrastructure

#### Total Cost of Ownership (TCO)

TCO compares the cost of running on-premises vs. cloud.

**On-Premises Costs:**
- Hardware purchase and refresh cycles
- Data center space, power, cooling
- Network infrastructure
- IT staff (hiring, training, retention)
- Software licensing
- Disaster recovery infrastructure
- Security equipment

**Cloud Costs:**
- Compute (per hour/second)
- Storage (per GB/month)
- Data transfer
- Managed service fees
- Support plans

**TCO Calculation:**
```
TCO = Direct Costs + Indirect Costs + Opportunity Costs

Cloud Savings = On-Premises TCO - Cloud TCO
```

**AWS TCO Calculator:** https://calculator.aws/pricing/2/

#### Billing and Cost Management

**AWS Cost Management Tools:**
- **AWS Cost Explorer** – Visualize and analyze spending
- **AWS Budgets** – Set spending alerts and limits
- **Cost and Usage Report** – Detailed billing data
- **AWS Pricing Calculator** – Estimate costs before deploying
- **Savings Plans / Reserved Instances** – Commit for discounts
- **Spot Instances** – Use spare capacity cheaply

**Cost Optimization Strategies:**
1. Right-size instances (use what you need)
2. Use auto-scaling to match demand
3. Choose appropriate pricing models (Reserved, Spot)
4. Delete unused resources (idle instances, old snapshots)
5. Use managed services to reduce operational overhead
6. Implement lifecycle policies on storage
7. Use CDN (CloudFront) to reduce data transfer costs

---

## Unit IV: Continuous Integration and Delivery (CI/CD)

---

### 1. CI/CD Pipeline Fundamentals

**Continuous Integration (CI):**
- Developers frequently merge code to a shared branch (multiple times/day)
- Each merge triggers automated build and test processes
- Goal: Detect and fix integration issues early

**Continuous Delivery (CD):**
- Extension of CI — every successful build is a release candidate
- Deployments are automated but may require manual approval for production

**Continuous Deployment:**
- Fully automated — every passing build auto-deploys to production
- No manual gates

```
CI/CD Pipeline Overview:

Code Commit → Source Control → CI Pipeline ──────────────────────────────────────────┐
                                    │                                                  │
                              ┌─────▼──────────────────────────────────────────────┐  │
                              │  Build → Unit Tests → Code Quality → Package       │  │
                              └─────────────────────────────┬──────────────────────┘  │
                                                            │ (artifact)               │
                              ┌─────────────────────────────▼──────────────────────┐  │
                              │  CD Pipeline                                        │  │
                              │  Deploy Staging → Integration Tests → Approval      │  │
                              │                                          │           │  │
                              │                                   Deploy Production  │  │
                              └────────────────────────────────────────────────────┘  │
                                                                                       │
                                                           Monitor & Feedback ─────────┘
```

**Benefits of CI/CD:**
- Faster time to market
- Reduced manual errors
- Consistent, repeatable deployments
- Early bug detection
- Smaller, safer releases
- Developer confidence

---

### 2. Tools and Methodologies

#### Jenkins

Jenkins is the most widely used open-source automation server for CI/CD.

**Jenkins Architecture:**
- **Master/Controller** – Orchestrates pipelines, manages agents
- **Agents/Nodes** – Execute the actual build/test/deploy tasks
- **Plugins** – 1800+ plugins extend functionality

**Jenkins Pipeline Types:**
1. **Freestyle** – Simple, GUI-configured jobs
2. **Declarative Pipeline** – Structured, readable `Jenkinsfile`
3. **Scripted Pipeline** – Groovy-based, more flexible

**Declarative Jenkinsfile:**

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'your-registry'
        IMAGE_NAME = 'my-app'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/org/repo.git'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Run Tests') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    junit 'test-results/*.xml'
                }
            }
        }
        
        stage('Code Quality') {
            steps {
                sh 'npm run lint'
                // SonarQube analysis
                withSonarQubeEnv('SonarQube') {
                    sh 'sonar-scanner'
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'registry-creds') {
                        docker.image("${IMAGE_NAME}:${IMAGE_TAG}").push()
                        docker.image("${IMAGE_NAME}:${IMAGE_TAG}").push('latest')
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            steps {
                sh 'kubectl apply -f k8s/ --namespace=staging'
            }
        }
        
        stage('Integration Tests') {
            steps {
                sh 'npm run test:integration'
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            input {
                message "Deploy to production?"
                ok "Yes, deploy!"
            }
            steps {
                sh 'kubectl apply -f k8s/ --namespace=production'
            }
        }
    }
    
    post {
        success {
            slackSend channel: '#deployments', message: "✅ Build #${BUILD_NUMBER} deployed successfully"
        }
        failure {
            slackSend channel: '#deployments', message: "❌ Build #${BUILD_NUMBER} failed"
            mail to: 'team@company.com', subject: "Build Failed", body: "Check Jenkins"
        }
        always {
            cleanWs()
        }
    }
}
```

#### Other CI/CD Tools

| Tool | Type | Key Feature |
|---|---|---|
| **GitHub Actions** | Cloud/SaaS | Native GitHub integration, YAML workflows |
| **GitLab CI/CD** | Cloud/Self-hosted | Built into GitLab, Auto DevOps |
| **CircleCI** | Cloud | Fast, Docker-native, orbs (reusable configs) |
| **Travis CI** | Cloud | Simple YAML config, good for open source |
| **ArgoCD** | GitOps | Kubernetes-native, declarative CD |
| **Tekton** | Cloud-native | Kubernetes-native CI/CD pipelines |
| **Spinnaker** | Multi-cloud | Multi-cloud deployment strategies |

---

### 3. Automating Code Builds, Tests, and Deployments

#### Code Build Automation

```groovy
// Maven (Java)
sh 'mvn clean package -DskipTests'

// Node.js
sh 'npm ci && npm run build'

// Go
sh 'go build -o app ./cmd/main.go'

// Docker
sh 'docker build -t myapp:${BUILD_NUMBER} .'
```

#### Test Automation Categories

1. **Unit Tests** – Test individual functions/methods (Jest, JUnit, pytest)
2. **Integration Tests** – Test component interactions
3. **API Tests** – Test HTTP endpoints (Postman, Newman, REST Assured)
4. **UI Tests** – Test browser interactions (Selenium, Cypress, Playwright)
5. **Performance Tests** – Load/stress testing (JMeter, k6, Gatling)
6. **Security Tests** – SAST, DAST, dependency scanning (SonarQube, OWASP ZAP)

**Test Pyramid:**
```
        ┌──────┐
        │  E2E  │     ← Few, slow, expensive
       ┌┴──────┴┐
       │Integration│  ← Some
      ┌┴──────────┴┐
      │ Unit Tests  │  ← Many, fast, cheap
      └────────────┘
```

#### Deployment Strategies

**Rolling Deployment:**
- Gradually replace old instances with new ones
- Zero downtime, rollback possible

**Blue-Green Deployment:**
```
Blue (v1) ← Production traffic
Green (v2) ← New version deployed, tested

Switch traffic → Green becomes production, Blue stands by
```

**Canary Deployment:**
```
90% traffic → Stable version (v1)
10% traffic → Canary version (v2)

Monitor → If healthy, gradually shift 100% to v2
```

**Feature Flags:**
- Deploy code but control feature activation
- Enables A/B testing and gradual rollouts

---

### 4. Integrating with Cloud Infrastructure

#### Jenkins + Kubernetes Integration

```groovy
// Using Kubernetes plugin - dynamic agents
pipeline {
    agent {
        kubernetes {
            yaml '''
                apiVersion: v1
                kind: Pod
                spec:
                  containers:
                  - name: maven
                    image: maven:3.8.1-jdk-11
                    command: ['cat']
                    tty: true
                  - name: docker
                    image: docker:20.10
                    command: ['cat']
                    tty: true
            '''
        }
    }
    stages {
        stage('Build') {
            steps {
                container('maven') {
                    sh 'mvn clean package'
                }
            }
        }
    }
}
```

#### Jenkins + AWS Integration

```groovy
// Deploy to EKS
stage('Deploy to EKS') {
    steps {
        withAWS(credentials: 'aws-creds', region: 'us-east-1') {
            sh 'aws eks update-kubeconfig --name my-cluster'
            sh 'kubectl apply -f k8s/'
        }
    }
}

// Deploy Lambda function
stage('Deploy Lambda') {
    steps {
        withAWS(credentials: 'aws-creds', region: 'us-east-1') {
            sh 'aws lambda update-function-code --function-name my-func --zip-file fileb://function.zip'
        }
    }
}
```

---

## Unit V: Monitoring, Observability, and Security

---

### 1. Monitoring and Observability

#### The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                         │
│                                                         │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐       │
│    │  Logs   │      │ Metrics │      │ Traces  │       │
│    │         │      │         │      │         │       │
│    │"What    │      │"How much│      │"Where   │       │
│    │happened"│      │/how fast│      │did it   │       │
│    │         │      │is it?"  │      │happen?" │       │
│    └─────────┘      └─────────┘      └─────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Logs:** Timestamped records of events (errors, requests, transactions)
**Metrics:** Numerical measurements over time (CPU %, response time, request count)
**Traces:** Tracking a request across distributed services (distributed tracing)

#### Prometheus

Prometheus is an open-source monitoring system with time-series database, originally built at SoundCloud.

**Architecture:**

```
┌──────────────────────────────────────────────────────────┐
│                      Prometheus Server                    │
│  ┌───────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │  Scrape   │   │    TSDB      │   │    HTTP API     │ │
│  │  Engine   │──▶│(Time Series  │──▶│  (PromQL Query) │ │
│  │           │   │   Database)  │   │                 │ │
│  └─────┬─────┘   └──────────────┘   └────────┬────────┘ │
│        │                                      │          │
└────────┼──────────────────────────────────────┼──────────┘
         │ scrape /metrics                       │
    ┌────▼────┐  ┌─────────┐            ┌────────▼──────┐
    │Exporters│  │ PushGW  │            │    Grafana    │
    │node_exp │  │         │            │  (Dashboard)  │
    │cadvisor │  │         │            └───────────────┘
    └─────────┘  └─────────┘
         │
    ┌────▼────────────────┐
    │  Alertmanager       │
    │  (Email/Slack/PD)   │
    └─────────────────────┘
```

**Key Prometheus Concepts:**
- **Scraping** – Prometheus pulls metrics from targets via HTTP `/metrics` endpoint
- **PromQL** – Query language for Prometheus metrics
- **Exporters** – Adapters that expose metrics (node_exporter, mysqld_exporter)
- **Pushgateway** – For short-lived jobs that can't be scraped
- **Alertmanager** – Handles alerts, deduplication, routing

**Metric Types:**
- **Counter** – Monotonically increasing value (requests_total)
- **Gauge** – Value that can go up or down (cpu_usage, memory_usage)
- **Histogram** – Samples observations into buckets (request_duration_seconds)
- **Summary** – Similar to histogram, calculates configurable quantiles

**PromQL Examples:**

```promql
# Request rate over 5 minutes
rate(http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage by instance
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory available
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100

# Pods not running
kube_pod_status_phase{phase!="Running"} == 1

# Alert: high error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
```

**Prometheus Configuration:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
  
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
```

#### Grafana

Grafana is an open-source analytics and visualization platform for metrics, logs, and traces.

**Features:**
- Beautiful, customizable dashboards
- Supports 50+ data sources (Prometheus, Elasticsearch, InfluxDB, CloudWatch)
- Alerting and notifications
- User management and permissions
- Template variables for dynamic dashboards

**Popular Grafana Dashboards:**
- Node Exporter Full (ID: 1860) – System metrics
- Kubernetes Cluster (ID: 7249) – K8s overview
- Docker Container (ID: 193) – Container metrics
- Spring Boot (ID: 12900) – JVM/Spring metrics

**Grafana Dashboard JSON structure:**
```json
{
  "dashboard": {
    "title": "My Application Dashboard",
    "panels": [
      {
        "type": "graph",
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      }
    ]
  }
}
```

#### Log Collection — ELK Stack

```
Applications → Logstash/Filebeat → Elasticsearch → Kibana
              (collect & parse)    (store & index)  (visualize)
```

- **Elasticsearch** – Distributed search and analytics engine
- **Logstash** – Data processing pipeline (collect, parse, transform)
- **Kibana** – Visualization and dashboard UI
- **Beats** – Lightweight data shippers (Filebeat, Metricbeat)

**Log Levels (ascending severity):**
DEBUG → INFO → WARNING → ERROR → CRITICAL

---

### 2. Cloud Security Concepts

#### IAM (Identity and Access Management)

IAM is the framework for managing digital identities and controlling access to resources.

**Core IAM Concepts:**

```
┌─────────────────────────────────────────────────────────┐
│                         IAM                              │
│                                                         │
│  Identity          Authentication      Authorization    │
│  "Who are you?"    "Prove it"          "What can you    │
│                                         do?"            │
│  ┌──────────┐      ┌──────────┐        ┌────────────┐  │
│  │ Users    │      │Password  │        │  Policies  │  │
│  │ Groups   │  ──▶ │MFA/TOTP  │  ───▶  │  Roles     │  │
│  │ Service  │      │Certs/Keys│        │  Permissions│  │
│  │ Accounts │      └──────────┘        └────────────┘  │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

**AWS IAM Key Components:**

- **Users** – Individual identities with long-term credentials
- **Groups** – Collection of users with shared permissions
- **Roles** – Temporary credentials assumed by services, users, or applications
- **Policies** – JSON documents defining permissions (Allow/Deny on Actions/Resources)

**IAM Best Practices:**
1. Apply **Principle of Least Privilege** – Grant only permissions required
2. Enable **MFA** for all users, especially root account
3. **Never use root account** for day-to-day operations
4. Use **IAM roles** for EC2 instances (not access keys)
5. Rotate access keys regularly
6. Use **Service Control Policies (SCPs)** in AWS Organizations
7. Enable **CloudTrail** to audit all API calls
8. Review and remove unused users and permissions

**Example IAM Policy (AWS):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::my-bucket/*"
    },
    {
      "Effect": "Deny",
      "Action": "s3:DeleteBucket",
      "Resource": "*"
    }
  ]
}
```

#### Network Security

**Defense in Depth:**
```
Internet → WAF → Load Balancer → Security Groups → NACLs → Application
```

- **VPC (Virtual Private Cloud)** – Isolated network in the cloud
- **Security Groups** – Stateful firewall at instance level
- **NACLs (Network ACLs)** – Stateless firewall at subnet level
- **VPN / Direct Connect** – Secure connectivity to on-premises
- **WAF (Web Application Firewall)** – Protect against web attacks (SQLi, XSS)

#### Data Security

**Data Encryption:**

- **At Rest** – Encrypt stored data (AES-256)
  - AWS: S3 SSE, EBS encryption, RDS encryption, KMS
- **In Transit** – Encrypt data in motion (TLS/SSL)
  - HTTPS, TLS 1.2+, certificate management (ACM)
- **Key Management** – Secure key storage and rotation
  - AWS KMS, HashiCorp Vault, Azure Key Vault

#### DevSecOps — Shifting Security Left

Integrating security throughout the DevOps pipeline:

```
Plan → Code → Build → Test → Release → Deploy → Monitor
 │       │      │       │        │         │        │
 │      SAST  Dep.    DAST    Security   Config  Runtime
 │           Scan    Tests    Review     Scan    Security
 │
 Threat
Modeling
```

**Security Tools by Stage:**

| Stage | Tool | Purpose |
|---|---|---|
| Code | SonarQube, Checkmarx | SAST - Static analysis |
| Build | Snyk, OWASP Dependency-Check | Dependency vulnerability scanning |
| Container | Trivy, Clair, Anchore | Container image scanning |
| Test | OWASP ZAP, Burp Suite | DAST - Dynamic analysis |
| Infrastructure | Checkov, tfsec | IaC security scanning |
| Runtime | Falco, AWS GuardDuty | Runtime threat detection |

#### Cloud Security Shared Responsibility Model

```
┌─────────────────────────────────────────────────────────┐
│                CUSTOMER RESPONSIBILITY                   │
│                    "Security IN the Cloud"               │
│  • Data                    • Applications               │
│  • Identity & Access       • OS, Network config (IaaS)  │
│  • Client-side encryption  • Platform & App Mgmt (PaaS) │
├─────────────────────────────────────────────────────────┤
│                PROVIDER RESPONSIBILITY                   │
│                    "Security OF the Cloud"               │
│  • Physical security       • Network infrastructure     │
│  • Hardware/firmware       • Virtualization layer       │
│  • Data center             • Global infrastructure      │
└─────────────────────────────────────────────────────────┘
```

#### Compliance and Governance

**Common Compliance Standards:**
- **SOC 2** – Security, availability, processing integrity
- **ISO 27001** – Information security management
- **PCI-DSS** – Payment card industry data security
- **HIPAA** – Health Insurance Portability and Accountability (healthcare)
- **GDPR** – General Data Protection Regulation (EU data privacy)

**AWS Compliance Services:**
- **AWS Config** – Continuously monitor and record resource configurations
- **AWS CloudTrail** – Audit log of all API calls
- **AWS Security Hub** – Centralized security findings
- **AWS Inspector** – Automated security assessment
- **AWS Macie** – Discover and protect sensitive data in S3
- **AWS GuardDuty** – Intelligent threat detection

---

## Quick Reference Summary

### Cloud Service Models
- **IaaS** → You manage OS and above; provider manages hardware/virtualization
- **PaaS** → You manage application and data; provider manages runtime and below
- **SaaS** → Provider manages everything; you just use the software

### Key Tools by Category

| Category | Tools |
|---|---|
| Version Control | Git, GitHub, GitLab, Bitbucket |
| Containerization | Docker, Podman |
| Orchestration | Kubernetes, Docker Swarm |
| CI/CD | Jenkins, GitHub Actions, GitLab CI, CircleCI |
| IaC | Terraform, CloudFormation, Ansible, Pulumi |
| Monitoring | Prometheus, Grafana, Datadog, New Relic |
| Logging | ELK Stack (Elasticsearch, Logstash, Kibana), Fluentd |
| Security | SonarQube, Trivy, OWASP ZAP, HashiCorp Vault |
| Cloud Platforms | AWS, GCP, Azure, OpenStack |

### DevOps Principles (CALMS)
- **C**ulture – Collaboration, shared responsibility
- **A**utomation – Automate repetitive tasks
- **L**ean – Eliminate waste, optimize flow
- **M**easurement – Measure everything, data-driven decisions
- **S**haring – Share knowledge, tools, and processes

---

*Notes compiled covering Units I–V: Cloud Computing fundamentals, Virtualization, IaC, CI/CD, Monitoring, and Security.*
