# Use Node.js 20 based on Debian Bookworm (which includes Python 3.11)
FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install Node.js dependencies
# Switched to npm for better stability in constrained environments
RUN npm install

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
# We install globally in the container to avoid venv complexity, or we can use a venv.
# Using a venv is safer practice even in Docker.
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Expose the port
ENV PORT=3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
