//@ts-check

// messageQueue.js

class MessageQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.prefetchCount = 1;
    this.indexKeys = [];
    this.activeJobs = new Map(); // socketId => count
    this.locks = new Set(); // keys currently being processed
    this.subscribers = new Set(); // WebSocket clients
  }

  configure({ prefetch, index }) {
    if (typeof prefetch === 'number') this.prefetchCount = prefetch;
    if (Array.isArray(index)) this.indexKeys = index;
  }

  enqueue(job) {
    this.jobs.push(job);
    this.dispatch();
  }

  subscribe(socket) {
    this.subscribers.add(socket);
    socket.on('close', () => {
      this.subscribers.delete(socket);
      this.activeJobs.delete(socket.id);
    });
    this.dispatch();
  }

  ack(jobId, keyHash, socket) {
    this.locks.delete(keyHash);
    this.activeJobs.set(socket.id, (this.activeJobs.get(socket.id) || 1) - 1);
    this.dispatch();
  }

  dispatch() {
    for (const socket of this.subscribers) {
      const active = this.activeJobs.get(socket.id) || 0;
      if (active >= this.prefetchCount) continue;

      for (let i = 0; i < this.jobs.length; i++) {
        const job = this.jobs[i];
        const keyHash = this.indexKeys.map(k => job[k]).join('|');
        if (keyHash && this.locks.has(keyHash)) continue;

        this.jobs.splice(i, 1);
        this.locks.add(keyHash);
        this.activeJobs.set(socket.id, active + 1);
        socket.send(JSON.stringify({
          type: 'job',
          jobId: `${Date.now()}-${Math.random()}`,
          data: job,
          keyHash
        }));
        break;
      }
    }
  }
}

module.exports = MessageQueue;
