# Use Node.js as the base image
FROM node:20-slim

# Set work directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port 5173 (Vite default)
EXPOSE 5173

# Start the development server
# --host 0.0.0.0 is required for Docker to expose the port correctly
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
