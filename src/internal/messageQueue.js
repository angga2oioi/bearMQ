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

    if (typeof prefetch === 'number') {
      if (!isFinite(prefetch) || prefetch <= 0) {
        prefetch = 1
      }
      this.prefetchCount = prefetch;
    }
    if (Array.isArray(index)) this.indexKeys = index;
  }

  enqueue(job) {
    const jobId = `${Date.now()}-${Math.random()}`;
    if (this.isFanout) {
      // Push job to every subscriber’s personal queue
      for (const socket of this.subscribers) {
        const active = this.activeJobs.get(socket.id) || [];
        if (active.length >= this.prefetchCount) continue;

        socket.send(JSON.stringify({
          type: 'job',
          jobId,
          data: job,
          keyHash: null,
        }));

        active.push({ jobId, job, });
        this.activeJobs.set(socket.id, active);
      }
    } else {
      // Task queue behavior
      const keyHash = this.indexKeys.map(k => job[k]).join('|');
      this.jobs.push({ job, jobId, keyHash });
      queueMicrotask(() => this.dispatch());
    }
  }


  subscribe(socket) {
    this.subscribers.add(socket);
    socket.on('close', () => {
      this.subscribers.delete(socket);
      this.activeJobs.delete(socket.id);
    });
    queueMicrotask(() => this.dispatch());
  }

  ack(jobId, socket) {
    const activeJobs = this.activeJobs.get(socket.id);
    if (activeJobs) {
      const jobIndex = activeJobs.findIndex(n => n.jobId === jobId);

      if (jobIndex >= 0) {
        if (!this.isFanout) {
          const { keyHash } = activeJobs[jobIndex]
          if (keyHash) this.locks.delete(keyHash)

        }
        activeJobs.splice(jobIndex, 1)
        this.activeJobs.set(socket.id, activeJobs);


        if (!this.isFanout) queueMicrotask(() => this.dispatch());
      } else {
        console.error("Job ID mismatch or invalid acknowledgment");
      }
    } else {
      console.error("No active jobs for this socket");
    }
  }



  dispatch() {
    if (this.isFanout) return;

    if (!this.subscribers || this.subscribers.size < 1) return;

    for (const socket of this.subscribers) {

      const activeJobs = this.activeJobs.get(socket.id) || [];
      const availableSlots = this.prefetchCount - activeJobs.length;

      if (availableSlots <= 0) continue;

      const jobsToProcess = this.jobs.splice(0, availableSlots); // Take the first `availableSlots` jobs
      const duplicateJobs = [];

      // Use a more optimized loop and reduce redundant lookups
      for (const jobData of jobsToProcess) {
        if (!jobData) continue; // Prevent processing null or undefined items

        const { job, keyHash, jobId } = jobData;
        if (!job) continue;

        if (keyHash && this.locks.has(keyHash)) {
          duplicateJobs.push({ job, keyHash, jobId }); // Collect duplicate jobs
          continue; // Skip duplicate jobs
        }

        // Process the job
        this.locks.add(keyHash); // Lock the key
        activeJobs.push({ jobId, job, keyHash });
        this.activeJobs.set(socket.id, activeJobs);

        try {
          socket.send(JSON.stringify({ type: 'job', data: job, jobId, keyHash }));
        } catch (err) {
          console.error("Failed to send job:", err);
          this.locks.delete(keyHash);
        }
      }

      if (duplicateJobs.length > 0) {
        // Re-add duplicate jobs back to the queue
        this.jobs.push(...duplicateJobs);
      }

    }

    if (this.jobs.length > 0) {
      queueMicrotask(() => this.dispatch());
    }
  }

}

module.exports = MessageQueue;
