# ============================================================
# Dockerfile — Frontend (React + Vite)
# Multi-stage build: build React app → serve bằng nginx
# ============================================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files trước → tận dụng Docker layer cache
COPY package.json package-lock.json ./

RUN npm ci

# Copy toàn bộ source code
COPY . .

# Biến môi trường cho Vite (truyền lúc build)
# ARG: nhận giá trị từ docker-compose build args hoặc --build-arg
# ENV: gán vào môi trường để Vite đọc được qua import.meta.env
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build React → file tĩnh (HTML, JS, CSS) trong dist/
RUN npm run build

# ---------- Stage 2: Serve ----------
# Dùng nginx Alpine (~8MB) thay vì Node.js
# React app là file tĩnh — không cần Node runtime ở production
FROM nginx:alpine AS production

# Copy kết quả build vào thư mục mặc định nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config tùy chỉnh:
# - SPA routing: mọi path → index.html (để React Router xử lý)
# - Proxy /api → backend container
# - Proxy /socket.io → backend container (WebSocket)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
