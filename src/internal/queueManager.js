//@ts-check

// queueManager.js

const MessageQueue = require('./messageQueue');

class QueueManager {
  constructor() {
    this.queues = new Map();
  }

  getQueue(name, opts = {}) {
    if (!this.queues.has(name)) {
      this.queues.set(name, new MessageQueue(name, opts.fanout));
    }
    return this.queues.get(name);
  }

  configureQueue(name, config) {
    const { fanout, ...rest } = config;
    const queue = this.getQueue(name, { fanout });
    queue.configure(rest);
  }

  enqueueJob(name, job) {
    const queue = this.getQueue(name);
    queue.enqueue(job);
  }

  subscribeToQueue(name, socket) {
    const queue = this.getQueue(name);
    queue.subscribe(socket);
  }

  ackJob(name, jobId, socket) {
    const queue = this.getQueue(name);
    queue.ack(jobId, socket);
  }
}

module.exports = new QueueManager();
