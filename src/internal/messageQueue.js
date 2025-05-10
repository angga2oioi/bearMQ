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
    const job = this.activeJobs.get(socket.id);
    if (job && job.jobId === jobId) {
      this.locks.delete(keyHash); // Release the lock for the key
      this.activeJobs.set(socket.id, { ...job, jobId: null }); // Mark job as completed for the socket
      this.dispatch(); // Dispatch next job
    } else {
      // Handle error if the jobId doesn't match (optional)
      console.error("Job ID mismatch or invalid acknowledgment");
    }
  }

  dispatch() {
    for (const socket of this.subscribers) {
      const active = this.activeJobs.get(socket.id) || 0;
      const availableSlots = this.prefetchCount - active;
      if (availableSlots <= 0) continue;

      const jobsToProcess = this.jobs.slice(0, availableSlots); // Take the first `availableSlots` jobs
      const duplicateJobs = [];

      // Loop over the jobs to process
      for (let i = 0; i < jobsToProcess.length; i++) {
        const job = jobsToProcess[i];
        const keyHash = this.indexKeys.map(k => job[k]).join('|');

        if (keyHash && this.locks.has(keyHash)) {
          duplicateJobs.push(job); // Collect duplicate jobs
          continue; // Skip duplicate jobs
        }

        // Otherwise, process the job
        this.jobs.splice(this.jobs.indexOf(job), 1);  // Remove the job from the queue
        this.locks.add(keyHash);                      // Lock the key
        this.activeJobs.set(socket.id, (this.activeJobs.get(socket.id) || 0) + 1);

        socket.send(JSON.stringify({
          type: 'job',
          jobId: `${Date.now()}-${Math.random()}`,
          data: job,
          keyHash,
        }));
      }

      // Re-add duplicate jobs back to the queue for retrying later
      for (const job of duplicateJobs) {
        this.jobs.push(job); // Push back to the queue
      }
    }
  }

}

module.exports = MessageQueue;
