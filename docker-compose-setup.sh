#!/usr/bin/env bash

# Docker Compose setup for FixIt Connect production-like environment

cat > docker-compose.yml << 'EOF'
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: fixit_postgres
    environment:
      POSTGRES_DB: fixit_connect
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: fixit_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fixit_backend
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: fixit_connect
      DB_USER: postgres
      DB_PASSWORD: postgres
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      FROM_EMAIL: ${FROM_EMAIL:-no-reply@fixitconnect.com}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@fixitconnect.com}
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: fixit_frontend
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:5000/api}
      VITE_SOCKET_URL: ${VITE_SOCKET_URL:-http://localhost:5000}
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: fixit_network
EOF

echo "✅ docker-compose.yml created"
echo ""
echo "Usage:"
echo "  docker-compose up -d      # Start all services"
echo "  docker-compose down       # Stop all services"
echo "  docker-compose logs -f    # View logs"
echo ""
