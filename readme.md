# bearMQ

bearMQ is a message queue server built using Node.js, capable of handling both HTTP and WebSocket connections. It utilizes a simple queue management system to enqueue jobs and allows clients to subscribe to queues and receive notifications.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [License](#license)

## Features

- HTTP API to enqueue jobs and configure queues.
- WebSocket support for real-time job delivery.
- Simple job acknowledgement mechanism for reliable message processing.
- Configurable prefetch count and index keys for custom queue management.
- Built-in locking mechanism to prevent race conditions by ensuring that jobs with the same indexed key are processed one at a time, maintaining data consistency.

Note: This is not production-ready software. Please use it with caution and evaluate it carefully before deploying in a production environment.

## Getting Started

### Prerequisites

Make sure you have Node.js (version 18 or higher) installed on your machine. You can check your version by running:

```bash
node -v
```

### Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd bearMQ
npm install
```

### Build the Project

Build the project using the following command:

```bash
npm run build
```

### Run the Server

You can run the server in different modes:

- **Local Mode**: This runs the server directly.
  
  ```bash
  npm run start:local
  ```

- **Production Mode**: This runs the server using PM2, which is a process manager for Node.js applications.
  
  ```bash
  npm run start:production
  ```
- **Using Docker**: Alternatively, you can run the server using the official Docker image from Docker Hub. This is useful if you prefer to use Docker for containerization.
Pull the Docker image:
 
  ```bash
  docker pull your-dockerhub-username/bearmq:tag

  ```
Run the container:
```bash
docker run -p 3000:3000 your-dockerhub-username/bearmq:tag
```
## Configuration

### Queue Configuration

You can configure queues via an HTTP POST request to the `/config` endpoint:

```json
{
    "queue": "yourQueueName",
    "prefetch": 1,
    "index": ["key1", "key2"]
}
```

### Enqueue Jobs

To enqueue a job, send a POST request to the `/enqueue` endpoint:

```json
{
    "queue": "yourQueueName",
    "job": {
        "data": "your job payload"
    }
}
```

### WebSocket Subscription

Clients can connect to the WebSocket server and send a subscription message:

```json
{
    "type": "subscribe",
    "queue": "yourQueueName"
}
```

### Job Acknowledgement

Clients can acknowledge a job with the following message format:

```json
{
    "type": "ack",
    "queue": "yourQueueName",
    "jobId": "jobIdentifier",
    "keyHash": "hashOfTheJob"
}
```
## License

This project is licensed under the MIT License.