# Multi-stage Dockerfile for Angular frontend (build -> nginx)

FROM node:20-alpine AS builder
WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# copy sources and build
COPY . .
ARG BUILD_ENV=production
RUN npm run build -- --configuration=${BUILD_ENV}

# Runtime image: nginx serving Angular build
FROM nginx:stable-alpine

# copy built assets (copy inner dist/* so it works regardless of project name)
COPY --from=builder /app/dist/* /usr/share/nginx/html/

# optional custom nginx config (will be added alongside Dockerfile)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
