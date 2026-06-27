# --- Étape build : compile le SPA React+Vite en fichiers statiques ---
FROM node:22-alpine AS build
WORKDIR /app

# Couche de cache deps : ne se réinvalide que si package*.json change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Étape runtime : nginx sert dist/ et proxifie /api vers FastAPI ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
