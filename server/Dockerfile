# ============================================================
# Dockerfile — Backend (Express + TypeScript)
# Multi-stage build: giảm kích thước image production
# ============================================================

# ---------- Stage 1: Build ----------
# Dùng Node 20 Alpine làm base (nhẹ, chỉ ~50MB)
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files TRƯỚC source code
# → Docker cache layer này nếu package.json không đổi
#   thì npm ci không chạy lại, tiết kiệm thời gian build
COPY package.json package-lock.json ./

# npm ci: cài chính xác theo lockfile (nhanh + đáng tin hơn npm install)
# Cần devDependencies (typescript, ts-jest...) để chạy tsc
RUN npm ci

# Copy toàn bộ source code vào container
COPY . .

# Chạy TypeScript compiler → output JavaScript vào dist/
# Dùng tsconfig.build.json (chỉ compile src/, không compile tests/)
RUN npm run build

# ---------- Stage 2: Production ----------
# Tạo image mới từ đầu — chỉ giữ những gì cần cho runtime
# Không có TypeScript source, không có devDependencies
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev: chỉ cài production dependencies
# Giảm đáng kể kích thước image (không có typescript, jest, ts-jest...)
RUN npm ci --omit=dev

# Copy kết quả build từ stage 1
COPY --from=build /app/dist ./dist

# Port server lắng nghe (metadata — cần -p khi docker run để map)
EXPOSE 5000

# Chạy server bằng Node.js thuần (không cần tsx ở production)
CMD ["node", "dist/server.js"]
