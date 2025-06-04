# Stage 1: Build the React app
FROM node:22-alpine AS builder

WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy rest of the app
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Serve the app with NGINX
FROM nginx:1.25-alpine

# Set environment variables
ARG PORT=4204
ENV PORT=${PORT}

# Copy the built app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy public static content
COPY --from=builder /app/public /usr/share/nginx/html/public

# Remove default nginx config and replace it
RUN rm /etc/nginx/conf.d/default.conf

# Add custom NGINX config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the desired port
EXPOSE ${PORT}

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
