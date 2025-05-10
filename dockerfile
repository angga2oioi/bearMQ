# Stage 1: Build the application
FROM node:16-alpine AS builder

# Set the working directory inside the container for the build stage
WORKDIR /opt/app

# Copy the source code into the container
COPY ./src ./ 

# Install dependencies and build the application
RUN npm install
RUN npm run build

# Stage 2: Production image
FROM node:16-alpine

# Set the working directory for the production image
WORKDIR /opt/app

# Copy only the necessary files from the build stage
COPY --from=builder /opt/app/build ./build
COPY --from=builder /opt/app/package.json ./package.json
COPY --from=builder /opt/app/processes.json ./processes.json

# Install PM2 globally
RUN npm install -g pm2

CMD ["npm", "run", "start:production"]
