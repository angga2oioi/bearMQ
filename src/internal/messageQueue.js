//@ts-check

// messageQueue.js

class MessageQueue {
  constructor(name, isFanout = false) {
    this.name = name;
    this.isFanout = isFanout;
    this.jobs = [];
    this.prefetchCount = 1;
    this.indexKeys = [];
    this.activeJobs = new Map(); // socketId => [jobs]
    this.locks = new Set(); // for task queue only
    this.subscribers = new Set();
  }


  configure({ prefetch, index }) {
    if (typeof prefetch === 'number') this.prefetchCount = prefetch;
    if (Array.isArray(index)) this.indexKeys = index;
  }

  enqueue(job) {
    if (this.isFanout) {
      // Push job to every subscriber’s personal queue
      for (const socket of this.subscribers) {
        const active = this.activeJobs.get(socket.id) || [];
        if (active.length >= this.prefetchCount) continue;

        const jobId = `${Date.now()}-${Math.random()}`;
        socket.send(JSON.stringify({
          type: 'job',
          jobId,
          data: job,
          keyHash: null,
        }));

        active.push({ jobId, job });
        this.activeJobs.set(socket.id, active);
      }
    } else {
      // Task queue behavior
      this.jobs.push(job);
      this.dispatch();
    }
  }


  subscribe(socket) {
    this.subscribers.add(socket);
    socket.on('close', () => {
      this.subscribers.delete(socket);
      this.activeJobs.delete(socket.id);
    });
    this.dispatch();
  }

  ack(jobId, socket) {
    const jobs = this.activeJobs.get(socket.id);

    if (jobs) {
      const jobIndex = jobs.findIndex(job => job.jobId === jobId);
      const job = jobs[jobIndex]
      const keyHash = this.indexKeys.map(k => job[k]).join('|');
      if (jobIndex >= 0) {
        if (!this.isFanout) this.locks.delete(keyHash);
        jobs.splice(jobIndex, 1);
        this.activeJobs.set(socket.id, jobs);
        if (!this.isFanout) this.dispatch();
      } else {
        console.error("Job ID mismatch or invalid acknowledgment");
      }
    } else {
      console.error("No active jobs for this socket");
    }
  }



  dispatch() {
    if (this.isFanout) return;
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
