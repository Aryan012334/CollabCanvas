// ============================================================
// Jenkinsfile — CollabDraw CI/CD Pipeline
//
// WHAT THIS DOES:
// Every time you push code to GitHub, Jenkins automatically:
//   1. Pulls the latest code
//   2. Builds Docker images for all three services
//   3. Pushes images to Docker Hub
//   4. Deploys the new images to Kubernetes (EKS)
//
// PIPELINE STAGES:
//   Checkout → Build Images → Push Images → Deploy to K8s
//
// PREREQUISITES (configure in Jenkins):
//   - Credential ID "dockerhub-creds"  → Docker Hub username + password
//   - Credential ID "kubeconfig"       → your ~/.kube/config file content
//   - Docker installed on Jenkins agent
//   - kubectl installed on Jenkins agent
// ============================================================

pipeline {

    // Run on any available Jenkins agent
    agent any

    // ── Variables ──────────────────────────────────────────
    environment {
        // Your Docker Hub username — change this
        DOCKER_USER = "aryanyewale"

        // Image names (username/repo format for Docker Hub)
        IMAGE_HTTP = "${DOCKER_USER}/collabdraw-http"
        IMAGE_WS   = "${DOCKER_USER}/collabdraw-ws"
        IMAGE_WEB  = "${DOCKER_USER}/collabdraw-web"

        // Tag images with the Git commit hash so every build is unique
        // e.g. yourdockerhubusername/collabdraw-http:a1b2c3d
        IMAGE_TAG = "${env.GIT_COMMIT.take(7)}"

        // The Kubernetes namespace where CollabDraw lives
        K8S_NAMESPACE = "collabdraw"

        // Production URLs baked into the Next.js frontend image
        // Change these to your actual domain or ALB DNS name
        NEXT_PUBLIC_API_URL    = "https://your-domain.com/api"
        NEXT_PUBLIC_SOCKET_URL = "wss://your-domain.com/ws"
        NEXT_PUBLIC_SITE_URL   = "https://your-domain.com"
    }

    stages {

        // ── Stage 1: Checkout ───────────────────────────────
        // Pull the latest code from GitHub.
        // Jenkins does this automatically when triggered by a push,
        // but we make it explicit here for clarity.
        stage('Checkout') {
            steps {
                echo "Checking out source code..."
                checkout scm
            }
        }

        // ── Stage 2: Build Docker Images ────────────────────
        // Build all three service images from the repo root.
        // The build context must be "." (repo root) because the
        // Dockerfiles reference files across the monorepo.
        stage('Build Docker Images') {
            steps {
                echo "Building Docker images..."

                // Build HTTP backend
                sh """
                    docker build \
                        -f apps/http-backend/Dockerfile \
                        -t ${IMAGE_HTTP}:${IMAGE_TAG} \
                        -t ${IMAGE_HTTP}:latest \
                        .
                """

                // Build WebSocket server
                sh """
                    docker build \
                        -f apps/ws-server/Dockerfile \
                        -t ${IMAGE_WS}:${IMAGE_TAG} \
                        -t ${IMAGE_WS}:latest \
                        .
                """

                // Build Next.js frontend
                // NEXT_PUBLIC_* must be passed as build args — they get
                // baked into the JavaScript bundle at build time
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

                echo "All images built successfully."
            }
        }

        // ── Stage 3: Push to Docker Hub ─────────────────────
        // Log in to Docker Hub and push all three images.
        // "dockerhub-creds" is a Jenkins credential you create
        // in: Manage Jenkins → Credentials → Add Credentials
        // Type: Username with password
        stage('Push Images') {
            steps {
                echo "Pushing images to Docker Hub..."

                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USERNAME',
                    passwordVariable: 'DOCKER_PASSWORD'
                )]) {
                    sh "echo ${DOCKER_PASSWORD} | docker login -u ${DOCKER_USERNAME} --password-stdin"

                    // Push both the commit-tagged and latest versions
                    sh "docker push ${IMAGE_HTTP}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_HTTP}:latest"

                    sh "docker push ${IMAGE_WS}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_WS}:latest"

                    sh "docker push ${IMAGE_WEB}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_WEB}:latest"
                }

                echo "All images pushed successfully."
            }
        }

        // ── Stage 4: Deploy to Kubernetes ───────────────────
        // Update the running containers in EKS with the new images.
        // "kubectl set image" tells Kubernetes to pull the new image
        // and do a rolling update — zero downtime deployment.
        //
        // "kubeconfig" is a Jenkins credential (Secret file type)
        // containing your ~/.kube/config content.
        stage('Deploy to Kubernetes') {
            steps {
                echo "Deploying to Kubernetes..."

                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {

                    // Update each deployment with the new image tag
                    sh """
                        kubectl set image deployment/http-backend \
                            http-backend=${IMAGE_HTTP}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=${KUBECONFIG}
                    """

                    sh """
                        kubectl set image deployment/ws-server \
                            ws-server=${IMAGE_WS}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=${KUBECONFIG}
                    """

                    sh """
                        kubectl set image deployment/frontend \
                            frontend=${IMAGE_WEB}:${IMAGE_TAG} \
                            -n ${K8S_NAMESPACE} \
                            --kubeconfig=${KUBECONFIG}
                    """

                    // Wait for the rollout to finish before marking success
                    sh """
                        kubectl rollout status deployment/http-backend \
                            -n ${K8S_NAMESPACE} --kubeconfig=${KUBECONFIG}
                        kubectl rollout status deployment/ws-server \
                            -n ${K8S_NAMESPACE} --kubeconfig=${KUBECONFIG}
                        kubectl rollout status deployment/frontend \
                            -n ${K8S_NAMESPACE} --kubeconfig=${KUBECONFIG}
                    """
                }

                echo "Deployment complete."
            }
        }
    }

    // ── Post-pipeline actions ───────────────────────────────
    // These run after all stages, regardless of success or failure.
    post {
        success {
            echo "Pipeline succeeded. CollabDraw is live with tag: ${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed. Check the logs above for errors."
        }
        always {
            // Clean up Docker login credentials from the agent
            sh "docker logout || true"
        }
    }
}
