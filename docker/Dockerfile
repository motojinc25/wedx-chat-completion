# Multi-stage build for WeDX Chat Completion
FROM node:20-alpine AS frontend-builder

WORKDIR /backend
WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy frontend source (excluding node_modules and other build artifacts)
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/*.json ./
COPY frontend/*.ts ./
COPY frontend/*.mjs ./
COPY frontend/*.html ./
COPY frontend/.env ./
COPY backend/pyproject.toml ../backend/pyproject.toml

# Build frontend
RUN pnpm run build

# Python backend stage
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy backend files (excluding .venv and other build artifacts)
COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/*.py ./
COPY backend/features ./features
COPY backend/shared ./shared

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/backend/build-info.json ./build-info.json

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/version || exit 1

# Start the application
CMD ["uv", "run", "python", "main.py"]
