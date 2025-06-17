FROM node:18-alpine

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --only=production || npm install --only=production

COPY backend/ ./

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]