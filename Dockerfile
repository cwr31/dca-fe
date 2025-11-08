# 多阶段构建 Dockerfile
# 阶段1: 构建阶段
FROM node:20 AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装 Node.js 依赖
RUN npm ci

# 复制项目文件
COPY . .

# 确保 public 目录存在（如果不存在则创建空目录）
RUN mkdir -p public

# 构建 Next.js 应用
RUN npm run build

# 阶段2: 运行阶段
FROM node:20 AS runner

# 安装 Python 3、pip 和必要的系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# 从构建阶段复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制 Python 脚本和依赖（standalone 模式不会自动包含这些）
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/requirements.txt ./

# 创建 venv 并安装 Python 依赖（在切换用户之前，需要 root 权限）
RUN python3 -m venv venv && \
    venv/bin/pip install --no-cache-dir --upgrade pip && \
    venv/bin/pip install --no-cache-dir -r requirements.txt

# 设置正确的权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV VENV_PYTHON=/app/venv/bin/python
ENV APP_ROOT=/app

# 启动应用
CMD ["node", "server.js"]

