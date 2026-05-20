# CollabDraw — Terraform + AWS EKS Guide

Deploy CollabDraw to AWS EKS using Terraform.

---

## What Terraform Creates

```
AWS Account
└── VPC (10.0.0.0/16)
    ├── Public Subnet 1 (10.0.0.0/24) — AZ a
    ├── Public Subnet 2 (10.0.1.0/24) — AZ b
    ├── Internet Gateway
    ├── Route Table (0.0.0.0/0 → IGW)
    └── EKS Cluster (collabdraw-cluster)
        ├── Control Plane (managed by AWS — free)
        ├── Node Group (2× t3.medium EC2 instances)
        └── IAM Role for AWS Load Balancer Controller

ECR Repositories (Docker image storage)
    ├── collabdraw-http
    ├── collabdraw-ws
    └── collabdraw-web
```

## File Structure

```
terraform/
├── provider.tf          ← AWS + Kubernetes provider config
├── variables.tf         ← All configurable settings
├── vpc.tf               ← Network: VPC, subnets, IGW, route table
├── eks.tf               ← EKS cluster, node group, ALB IAM role
├── main.tf              ← ECR repositories
├── outputs.tf           ← Prints useful values after apply
└── terraform.tfvars.example  ← Copy this to terraform.tfvars
```

---

## Prerequisites

Install these tools before starting:

```bash
# 1. AWS CLI
# Download: https://aws.amazon.com/cli/
aws --version

# 2. Terraform
# Download: https://developer.hashicorp.com/terraform/install
terraform --version   # needs >= 1.6.0

# 3. kubectl (already installed)
kubectl version --client

# 4. Helm (for installing ALB Controller)
# Download: https://helm.sh/docs/intro/install/
helm version
```

Configure AWS credentials:
```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region:        us-east-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
```

---

## Step 1 — Configure Variables

```bash
cd terraform

# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values (region, cluster name, etc.)
# The defaults work fine for a student project
```

---

## Step 2 — Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads:
- AWS provider plugin (~50MB)
- EKS module and its dependencies

Expected output:
```
Terraform has been successfully initialized!
```

---

## Step 3 — Preview What Will Be Created

```bash
terraform plan
```

This shows every resource Terraform will create WITHOUT actually creating anything. Review it to make sure it looks right.

Key things to look for:
- `aws_vpc.main` — the VPC
- `aws_subnet.public[0]` and `[1]` — two subnets
- `module.eks` — the EKS cluster
- `aws_ecr_repository.*` — three ECR repos

---

## Step 4 — Create the Infrastructure

```bash
terraform apply
```

Type `yes` when prompted.

**This takes 15–20 minutes.** EKS cluster creation is slow — AWS is provisioning the control plane, node group, and all the IAM roles.

When it finishes, Terraform prints the outputs:
```
cluster_name           = "collabdraw-cluster"
cluster_endpoint       = "https://XXXX.gr7.us-east-1.eks.amazonaws.com"
ecr_http_url           = "123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-http"
kubectl_config_command = "aws eks update-kubeconfig ..."
next_steps             = "..."
```

---

## Step 5 — Connect kubectl to EKS

```bash
aws eks update-kubeconfig --region us-east-1 --name collabdraw-cluster

# Verify connection
kubectl get nodes
# NAME                          STATUS   ROLES    AGE   VERSION
# ip-10-0-0-xxx.ec2.internal    Ready    <none>   2m    v1.30.x
# ip-10-0-1-xxx.ec2.internal    Ready    <none>   2m    v1.30.x
```

---

## Step 6 — Install AWS Load Balancer Controller

The ALB Controller watches for Kubernetes Ingress resources and creates real AWS ALBs automatically.

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=collabdraw-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# Verify it's running
kubectl get deployment -n kube-system aws-load-balancer-controller
```

---

## Step 7 — Push Docker Images to ECR

```bash
# Get your AWS account ID
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

# Log Docker into ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push (run from repo root)
docker build -f apps/http-backend/Dockerfile \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-http:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-http:latest

docker build -f apps/ws-server/Dockerfile \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-ws:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-ws:latest

# Frontend needs the ALB DNS name baked in at build time.
# Get the ALB DNS after deploying the ingress (step 9), then rebuild.
# For now, use a placeholder:
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://YOUR-ALB-DNS/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://YOUR-ALB-DNS/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=https://YOUR-ALB-DNS \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-web:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-web:latest
```

---

## Step 8 — Update Kubernetes Deployment YAMLs

Update the image fields in the deployment files to use ECR URLs:

```bash
# k8s/http-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-http:latest

# k8s/ws-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-ws:latest

# k8s/frontend-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-web:latest
```

Also update `k8s/configmap.yaml` with your ALB DNS name:
```yaml
NEXT_PUBLIC_API_URL: "https://YOUR-ALB-DNS/api"
NEXT_PUBLIC_SOCKET_URL: "wss://YOUR-ALB-DNS/ws"
NEXT_PUBLIC_SITE_URL: "https://YOUR-ALB-DNS"
```

---

## Step 9 — Deploy the App to EKS

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/http-deployment.yaml
kubectl apply -f k8s/http-service.yaml
kubectl apply -f k8s/ws-deployment.yaml
kubectl apply -f k8s/ws-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml

# Run Prisma migrations
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
```

---

## Step 10 — Get the Public URL

```bash
# Wait ~2 minutes for the ALB to be created
kubectl get ingress -n collabdraw

# NAME                CLASS   HOSTS   ADDRESS                                    PORTS
# collabdraw-ingress  alb     *       k8s-collabdraw-xxx.us-east-1.elb.amazonaws.com   80
```

Open the ADDRESS in your browser — that's your live app.

---

## How Traffic Flows on EKS

```
User's Browser
      │
      ▼
AWS ALB  (created automatically by the ALB Controller when it sees ingress.yaml)
      │  DNS: k8s-collabdraw-xxx.us-east-1.elb.amazonaws.com
      │
      ├── /api/*  ──► http-backend Service ──► Express pods (EC2 nodes)
      │                                         └── PostgreSQL pod
      │
      ├── /ws     ──► ws-server Service   ──► WebSocket pod (EC2 nodes)
      │               (WebSocket upgrade happens here — needs target-type: ip)
      │
      └── /       ──► frontend Service    ──► Next.js pods (EC2 nodes)
```

**Why `target-type: ip` is required for WebSocket:**
WebSocket starts as HTTP then upgrades to a persistent connection. AWS ALB supports this only when routing directly to pod IPs (IP mode). In the default "instance mode" the upgrade handshake can fail.

---

## Verification Commands

```bash
# Check all pods are running
kubectl get pods -n collabdraw

# Check ingress has an ALB address
kubectl get ingress -n collabdraw

# Check services
kubectl get svc -n collabdraw

# View logs
kubectl logs -n collabdraw deployment/http-backend
kubectl logs -n collabdraw deployment/ws-server

# Describe a pod (shows events, errors)
kubectl describe pod -n collabdraw -l app=http-backend
```

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: configuring Terraform AWS Provider: no valid credential sources` | AWS CLI not configured | Run `aws configure` |
| `Error: creating EKS Cluster: InvalidParameterException: unsupported Kubernetes version` | Version not available in region | Change `cluster_version` in tfvars |
| `ImagePullBackOff` | Image not in ECR or wrong URL | Check ECR URL in deployment YAML matches `terraform output ecr_http_url` |
| Ingress has no ADDRESS after 5 min | ALB Controller not installed or not running | Check `kubectl get deployment -n kube-system aws-load-balancer-controller` |
| WebSocket disconnects immediately | ALB not in IP target mode | Ensure `alb.ingress.kubernetes.io/target-type: ip` is in ingress.yaml |
| `Unauthorized` on kubectl | kubeconfig not updated | Run `aws eks update-kubeconfig ...` again |
| Pods in `Pending` | Not enough node capacity | Increase `node_desired` in tfvars and run `terraform apply` |

---

## Cost Estimate

| Resource | Cost |
|----------|------|
| EKS Control Plane | $0.10/hour (~$72/month) |
| 2× t3.medium EC2 nodes | ~$0.0416/hour each (~$60/month total) |
| ALB | ~$0.008/hour + data transfer |
| ECR storage | ~$0.10/GB/month (negligible) |
| **Total estimate** | **~$135/month** |

**Cost-saving tips:**
- Scale nodes to 0 when not using: `kubectl scale deployment --replicas=0 -n collabdraw --all`
- Use `t3.small` instead of `t3.medium` (saves ~$30/month, may be tight)
- Run `terraform destroy` when done with the demo — stops all charges immediately

---

## Tear Down (Stop All AWS Charges)

```bash
# Delete Kubernetes resources first (removes the ALB)
kubectl delete namespace collabdraw

# Then destroy all AWS infrastructure
cd terraform
terraform destroy
```

Type `yes` when prompted. Takes ~10 minutes.

**Important:** Always run `kubectl delete namespace collabdraw` BEFORE `terraform destroy`. If you destroy the VPC while the ALB still exists, Terraform can get stuck because AWS won't delete a VPC with active load balancers.
