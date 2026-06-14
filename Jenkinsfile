pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        APP_NAME = 'mobilerun-web'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'git@github.com:xiaokaiCoding/mobilerun-web.git',
                        credentialsId: '19af8209-b26b-4745-a27b-41ecf3e9e80f'
                    ]],
                    extensions: [
                        [$class: 'CloneOption', timeout: 300, depth: 1, noTags: true],
                        [$class: 'CheckoutOption', timeout: 120]
                    ]
                ])
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh '''
                    cat > .env << 'ENVEOF'
DB_ROOT_PASSWORD=root
HTTP_PORT=81
ENVEOF

                    docker compose -f docker-compose.prod.yml down --remove-orphans --timeout 10 2>/dev/null || true
                    docker rm -f mobilerun-backend mobilerun-frontend mobilerun-nginx 2>/dev/null || true

                    docker compose -f docker-compose.prod.yml build --parallel
                    docker compose -f docker-compose.prod.yml up -d

                    docker image prune -f
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    sleep 10
                    RESULT=$(curl -sf http://127.0.0.1:81/api/health 2>&1) || true
                    if echo "$RESULT" | grep -q '"status"'; then
                        echo "✅ 健康检查通过"
                    else
                        echo "❌ 健康检查失败"
                        docker compose -f docker-compose.prod.yml ps
                        exit 1
                    fi
                '''
            }
        }
    }

    post {
        failure {
            echo "❌ 部署失败"
        }
        success {
            echo "✅ 部署成功"
        }
    }
}
