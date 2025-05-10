//@ts-check

// queueManager.js

const MessageQueue = require('./messageQueue');

class QueueManager {
  constructor() {
    this.queues = new Map();
  }

  getQueue(name) {
    if (!this.queues.has(name)) {
      this.queues.set(name, new MessageQueue(name));
    }
    return this.queues.get(name);
  }

  configureQueue(name, config) {
    const queue = this.getQueue(name);
    queue.configure(config);
  }

  enqueueJob(name, job) {
    const queue = this.getQueue(name);
    queue.enqueue(job);
  }

  subscribeToQueue(name, socket) {
    const queue = this.getQueue(name);
    queue.subscribe(socket);
  }

  ackJob(name, jobId, keyHash, socket) {
    const queue = this.getQueue(name);
    queue.ack(jobId, keyHash, socket);
  }
}

module.exports = new QueueManager();
