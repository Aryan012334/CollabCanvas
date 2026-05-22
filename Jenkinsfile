// ============================================================
// Jenkinsfile — CollabDraw CI/CD Pipeline
//
// FLOW:
//   git push → GitHub webhook → Jenkins
//     Stage 1: Checkout       — pull latest code
//     Stage 2: Build Images   — docker build all 3 services
//     Stage 3: Push to ECR    — push to AWS Elastic Container Registry
//     Stage 4: Deploy to EKS  — kubectl set image (rolling update)
//
// JENKINS CREDENTIALS REQUIRED:
//   "aws-credentials"  → AWS Access Key ID + Secret (type: AWS Credentials)
//   "kubeconfig"       → contents of ~/.kube/config (type: Secret file)
//
// JENKINS PLUGINS REQUIRED:
//   - Pipeline
//   - AWS Credentials Plugin
//   - Docker Pipeline
//   - Kubernetes CLI Plugin
// ============================================================

pipeline {

    agent any

    // ── Environment Variables ──────────────────────────────
    environment {
        // AWS configuration
        AWS_ACCOUNT_ID = "494487213388"
        AWS_REGION     = "ap-south-1"

        // ECR registry URL (account.dkr.ecr.region.amazonaws.com)
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

        // ECR image names
        IMAGE_HTTP = "${ECR_REGISTRY}/collabdraw-http"
        IMAGE_WS   = "${ECR_REGISTRY}/collabdraw-ws"
        IMAGE_WEB  = "${ECR_REGISTRY}/collabdraw-web"

        // Tag every image with the short Git commit hash
        // This makes every build uniquely identifiable and rollback possible
        // e.g. 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http:a1b2c3d
        IMAGE_TAG = "${env.GIT_COMMIT.take(7)}"

        // Kubernetes namespace
        K8S_NAMESPACE = "collabdraw"

        // EKS cluster name
        EKS_CLUSTER = "collabdraw-cluster"

        // ALB DNS — the public URL of the live application
        // This is baked into the Next.js frontend bundle at build time
        ALB_DNS = "k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com"

        // NEXT_PUBLIC_* variables are compiled into the JS bundle at build time.
        // The browser needs these URLs before the page loads.
        // They CANNOT be changed at runtime — must be set here.
        NEXT_PUBLIC_API_URL    = "http://${ALB_DNS}/api"
        NEXT_PUBLIC_SOCKET_URL = "ws://${ALB_DNS}/ws"
        NEXT_PUBLIC_SITE_URL   = "http://${ALB_DNS}"
    }

    stages {

        // ── Stage 1: Checkout ───────────────────────────────
        // Pull the latest code from GitHub.
        // Jenkins triggers this automatically via GitHub webhook on push.
        stage('Checkout') {
            steps {
                echo "=== Stage 1: Checkout ==="
                checkout scm
                echo "Branch: ${env.BRANCH_NAME}"
                echo "Commit: ${env.GIT_COMMIT}"
                echo "Image tag: ${IMAGE_TAG}"
            }
        }

        // ── Stage 2: Build Docker Images ────────────────────
        // Build all three service images from the monorepo root.
        // Build context MUST be "." (repo root) — Dockerfiles reference
        // files across packages/ and apps/ directories.
        stage('Build Docker Images') {
            steps {
                echo "=== Stage 2: Build Docker Images ==="

                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-credentials',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                ]]) {
                    // Login to ECR before building (needed to pull base images if cached)
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | \
                        docker login --username AWS --password-stdin ${ECR_REGISTRY}
                    """
                }

                // Build HTTP backend
                // Two tags: commit hash (for rollback) + latest (for convenience)
                sh """
                    docker build \
                        -f apps/http-backend/Dockerfile \
                        -t ${IMAGE_HTTP}:${IMAGE_TAG} \
                        -t ${IMAGE_HTTP}:latest \
                        .
                """
                echo "✅ http-backend built: ${IMAGE_HTTP}:${IMAGE_TAG}"

                // Build WebSocket server
                sh """
                    docker build \
                        -f apps/ws-server/Dockerfile \
                        -t ${IMAGE_WS}:${IMAGE_TAG} \
                        -t ${IMAGE_WS}:latest \
                        .
                """
                echo "✅ ws-server built: ${IMAGE_WS}:${IMAGE_TAG}"

                // Build Next.js frontend
                // NEXT_PUBLIC_* MUST be passed as --build-arg here.
                // These URLs get compiled into the JavaScript bundle.
                // If you change the ALB DNS, you must rebuild this image.
                sh """
                    docker build \
                        -f apps/web/Dockerfile \
                        --build-arg NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
                        --build-arg NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
                        --build-arg NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
                        -t ${IMAGE_WEB}:${IMAGE_TAG} \
                        -t ${IMAGE_WEB}:latest \
                        .
                """
                echo "✅ frontend built: ${IMAGE_WEB}:${IMAGE_TAG}"
                echo "All images built successfully."
            }
        }

        // ── Stage 3: Push to ECR ────────────────────────────
        // Push all three images to AWS Elastic Container Registry.
        // ECR is a private Docker registry inside your AWS account.
        // EKS pulls images from ECR without extra authentication
        // because both are in the same AWS account.
        stage('Push to ECR') {
            steps {
                echo "=== Stage 3: Push to ECR ==="

                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-credentials',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                ]]) {
                    // Authenticate Docker with ECR
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | \
                        docker login --username AWS --password-stdin ${ECR_REGISTRY}
                    """

                    // Push http-backend (both commit tag and latest)
                    sh "docker push ${IMAGE_HTTP}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_HTTP}:latest"
                    echo "✅ Pushed: ${IMAGE_HTTP}:${IMAGE_TAG}"

                    // Push ws-server
                    sh "docker push ${IMAGE_WS}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_WS}:latest"
                    echo "✅ Pushed: ${IMAGE_WS}:${IMAGE_TAG}"

                    // Push frontend
                    sh "docker push ${IMAGE_WEB}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_WEB}:latest"
                    echo "✅ Pushed: ${IMAGE_WEB}:${IMAGE_TAG}"
                }

                echo "All images pushed to ECR successfully."
            }
        }

        // ── Stage 4: Deploy to EKS ──────────────────────────
        // Update the running containers in EKS with the new images.
        //
        // HOW ROLLING UPDATE WORKS:
        //   kubectl set image → Kubernetes starts new pods with new image
        //   New pod passes readiness probe → old pod terminated
        //   Repeat for each replica → zero downtime
        //
        // "kubeconfig" is a Jenkins Secret File credential containing
        // the contents of ~/.kube/config (with EKS cluster context).
        stage('Deploy to EKS') {
            steps {
                echo "=== Stage 4: Deploy to EKS ==="
                echo "Deploying tag: ${IMAGE_TAG} to cluster: ${EKS_CLUSTER}"

                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {

                    // Update http-backend deployment with new image
                    sh """
                        kubectl set image deployment/http-backend \
                            http-backend=${IMAGE_HTTP}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=\${KUBECONFIG}
                    """

                    // Update ws-server deployment
                    sh """
                        kubectl set image deployment/ws-server \
                            ws-server=${IMAGE_WS}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=\${KUBECONFIG}
                    """

                    // Update frontend deployment
                    sh """
                        kubectl set image deployment/frontend \
                            frontend=${IMAGE_WEB}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=\${KUBECONFIG}
                    """

                    // Wait for all rollouts to complete before marking success.
                    // If any rollout fails (pod crashes, readiness probe fails),
                    // this step fails and Jenkins marks the build as failed.
                    sh """
                        kubectl rollout status deployment/http-backend \
                            -n ${K8S_NAMESPACE} --kubeconfig=\${KUBECONFIG} --timeout=120s
                    """
                    sh """
                        kubectl rollout status deployment/ws-server \
                            -n ${K8S_NAMESPACE} --kubeconfig=\${KUBECONFIG} --timeout=120s
                    """
                    sh """
                        kubectl rollout status deployment/frontend \
                            -n ${K8S_NAMESPACE} --kubeconfig=\${KUBECONFIG} --timeout=120s
                    """

                    // Print final pod status for the build log
                    sh """
                        kubectl get pods -n ${K8S_NAMESPACE} --kubeconfig=\${KUBECONFIG}
                    """
                }

                echo "Deployment complete. Live at: http://${ALB_DNS}"
            }
        }
    }

    // ── Post-pipeline actions ───────────────────────────────
    // Run after all stages regardless of success or failure.
    post {
        success {
            echo """
            ✅ Pipeline SUCCEEDED
            ─────────────────────────────────────
            Image tag:  ${IMAGE_TAG}
            Cluster:    ${EKS_CLUSTER}
            Namespace:  ${K8S_NAMESPACE}
            Live URL:   http://${ALB_DNS}
            ─────────────────────────────────────
            """
        }
        failure {
            echo """
            ❌ Pipeline FAILED
            Check the stage logs above for the error.
            To rollback to previous version:
              kubectl rollout undo deployment/http-backend -n ${K8S_NAMESPACE}
              kubectl rollout undo deployment/ws-server -n ${K8S_NAMESPACE}
              kubectl rollout undo deployment/frontend -n ${K8S_NAMESPACE}
            """
        }
        always {
            // Always log out of Docker to clean up credentials on the agent
            sh "docker logout ${ECR_REGISTRY} || true"
        }
    }
}
