# Use micromamba from mambaorg
FROM mambaorg/micromamba:1.5.8-alpine3.20

# Set the user to root to copy files and install dependencies
USER root

# Update the package index and install bash and tini
RUN apk add --no-cache bash tini

# Set work directory
WORKDIR /app

# Create a directory for the data
RUN mkdir data
RUN chown root:root data

# Install dependencies using micromamba
COPY ./ ./
RUN chmod +x ./run.sh

# Update current environment with environment.yml
RUN micromamba env create -y -f environment.yml && \
    micromamba clean --all --yes
    
# Expose port 5099
EXPOSE 5099

# Set entrypoint to use tini
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["./run.sh", "--skip-env-setup"]