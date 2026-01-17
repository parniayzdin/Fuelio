# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app-frontend

# Build args for frontend
ARG VITE_API_BASE_URL=""
# Hardcoded default for easier deployment (Context: User requested personalized guide)
ARG VITE_GOOGLE_MAPS_API_KEY="AIzaSyA0dqiFW_gxI556EJwI3RDSKDeCHjnL-jU"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Backend & Final Image
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (if any)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend build artifacts to a static directory
COPY --from=frontend-build /app-frontend/dist ./static

# Expose port (Cloud Run sets PORT env var)
ENV PORT=8080
EXPOSE 8080

# Run FastAPI app
# We use a shell command to ensure PORT env var is expanded
CMD sh -c "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"
