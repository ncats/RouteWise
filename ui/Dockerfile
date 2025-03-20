# Start from Node 22 Alpine image
FROM node:22-alpine

# Set environment variables for user and group
ARG USER=node
ARG GROUP=node

# Install curl, bash, and pnpm, and create the app directory in one RUN command
RUN apk add --no-cache curl bash
# Set the working directory
WORKDIR /app

# Copy the app files into the container and set ownership
COPY --chown=${USER}:${GROUP} ./ ./

# Install dependencies and build the app in one RUN command
RUN npm ci && npm run build

# Change to the node user
USER ${USER}

# Expose the port
EXPOSE 4204

# Start the app
CMD ["npm", "run", "start-prod", "--", "--port=4204"]
