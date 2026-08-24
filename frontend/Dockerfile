# ─── Stage 1: Build React App ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les dépendances en premier (cache Docker)
COPY package*.json ./
RUN npm install --silent --legacy-peer-deps

# Copier les sources et construire
COPY . .

# L'URL de l'API est injectée au moment du build
# En Docker, le navigateur appelle /api/ qui est proxié par nginx vers le backend
ARG REACT_APP_API_BASE=/api/spatial
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE

RUN npm run build

# ─── Stage 2: Serve avec Nginx ───────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copier le build React
COPY --from=builder /app/build /usr/share/nginx/html

# Copier la configuration nginx (proxy vers le backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
