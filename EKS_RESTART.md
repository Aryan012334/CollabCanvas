# CollabDraw — EKS Restart Guide

Use this every time you want to bring the cluster back up after deleting it.

---

## DELETE (stop all AWS charges)

```powershell
kubectl delete namespace collabdraw
eksctl delete cluster --name collabdraw-cluster --region ap-south-1
```

---

## RESTART (full recreate)

### Step 1 — Add tools to PATH (new terminal only)
```powershell
$env:PATH = "$env:PATH;$env:USERPROFILE\tools"
```

### Step 2 — Create cluster (~15-20 min)
```powershell
eksctl create cluster `
  --name collabdraw-cluster `
  --region ap-south-1 `
  --nodegroup-name workers `
  --node-type t3.small `
  --nodes 2 `
  --nodes-min 1 `
  --nodes-max 3 `
  --managed
```

### Step 3 — Connect kubectl
```powershell
aws eks update-kubeconfig --name collabdraw-cluster --region ap-south-1
kubectl get nodes
```

### Step 4 — Install EBS CSI driver + attach IAM policies
```powershell
eksctl create addon --name aws-ebs-csi-driver --cluster collabdraw-cluster --region ap-south-1 --force

# Get the new node role (changes every time cluster is recreated)
$ROLE = aws iam list-roles --query "Roles[?contains(RoleName, 'NodeInstanceRole')].RoleName" --output text
Write-Host "Role: $ROLE"

aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::494487213388:policy/AWSLoadBalancerControllerIAMPolicy"
```

### Step 5 — Install ALB Controller
```powershell
$VPC_ID = aws eks describe-cluster --name collabdraw-cluster --region ap-south-1 --query "cluster.resourcesVpcConfig.vpcId" --output text

helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller `
  -n kube-system `
  --set clusterName=collabdraw-cluster `
  --set serviceAccount.create=true `
  --set serviceAccount.name=aws-load-balancer-controller `
  --set region=ap-south-1 `
  --set vpcId=$VPC_ID
```

### Step 6 — Login to ECR
```powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 494487213388.dkr.ecr.ap-south-1.amazonaws.com
```

### Step 7 — Deploy the app
```powershell
cd E:\Projects\excal\CollabDraw

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

# Wait for all pods Running
kubectl get pods -n collabdraw -w
```

### Step 8 — Run migrations
```powershell
kubectl exec -n collabdraw deployment/http-backend -- sh -c "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
```

### Step 9 — Get new ALB URL (wait ~2 min)
```powershell
kubectl get ingress -n collabdraw
# Copy the ADDRESS column value
```

### Step 10 — Rebuild frontend with new ALB URL
```powershell
cd E:\Projects\excal\CollabDraw

# Replace YOUR-NEW-ALB-DNS with the address from Step 9
docker build `
  --build-arg NEXT_PUBLIC_API_URL=http://YOUR-NEW-ALB-DNS/api `
  --build-arg NEXT_PUBLIC_SOCKET_URL=ws://YOUR-NEW-ALB-DNS/ws `
  --build-arg NEXT_PUBLIC_SITE_URL=http://YOUR-NEW-ALB-DNS `
  -f apps/web/Dockerfile `
  -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest .

docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest

kubectl rollout restart deployment/frontend -n collabdraw
kubectl rollout status deployment/frontend -n collabdraw
```

**App is live at: http://YOUR-NEW-ALB-DNS**

---

## Notes

- **Step 10 is always required** — the ALB DNS changes every time the cluster is recreated, and `NEXT_PUBLIC_*` URLs are baked into the Next.js bundle at build time.
- **ECR images persist** — you don't need to rebuild http-backend or ws-server unless you changed their code.
- **AWS Account ID:** `494487213388`
- **Region:** `ap-south-1`
- **ECR repos:** `collabdraw-http`, `collabdraw-ws`, `collabdraw-web`
- **ALB Controller IAM Policy ARN:** `arn:aws:iam::494487213388:policy/AWSLoadBalancerControllerIAMPolicy` (already created, reuse it)
