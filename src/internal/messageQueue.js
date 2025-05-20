//@ts-check

// messageQueue.js

class MessageQueue {
  constructor(name, isFanout = false) {
    this.name = name;
    this.isFanout = isFanout;
    this.jobs = [];
    this.indexKeys = [];
    this.subscriberIndex = 0
    this.activeJobs = new Map(); // socketId => [jobs]
    this.locks = new Set(); // for task queue only
    this.subscribers = new Set();
  }


  configure({ index }) {

    if (Array.isArray(index)) this.indexKeys = index;
  }

  enqueue(job) {
    const jobId = `${Date.now()}-${Math.random()}`;

    if (this.isFanout) {
      // Push job to every subscriber’s personal queue
      for (const socket of this.subscribers) {
        const active = this.activeJobs.get(socket.id) || [];
        if (socket.prefetchCount && active.length >= socket.prefetchCount) continue;

        socket.send(JSON.stringify({
          type: 'job',
          data: [{ jobId, job, }],
        }));

        active.push({ jobId, job, });
        this.activeJobs.set(socket.id, active);
      }
    } else {
      // Task queue behavior
      let jobItem
      if (this.indexKeys.length > 0) {
        const keyHash = this.indexKeys.map(k => job[k]).join('|');

        if (keyHash && this.locks.has(keyHash)) {
          setTimeout(() => this.enqueue(job), 0)
          return null
        }

        this.locks.add(keyHash)
        jobItem = { job, jobId, keyHash };
      } else {
        jobItem = { job, jobId };
      }

      this.jobs.push(jobItem);
      if (this.subscribers.size > 0) {
        if (this.subscriberIndex >= this.subscribers.size) {
          this.subscriberIndex = 0;
        }

        const subscribersArray = Array.from(this.subscribers);
        const subscriber = subscribersArray[this.subscriberIndex];
        this.dispatch(subscriber);

        this.subscriberIndex += 1;
      }
    }
  }


  subscribe(socket) {
    this.subscribers.add(socket);

    socket.on('close', () => {
      this.subscribers.delete(socket);
      this.activeJobs.delete(socket.id);
    });
    socket.on('error', () => {
      this.subscribers.delete(socket);
      this.activeJobs.delete(socket.id);
    });
    this.dispatch(socket);
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


        if (!this.isFanout) this.dispatch(socket);
      } else {
        console.error("Job ID mismatch or invalid acknowledgment");
      }
    } else {
      console.error("No active jobs for this socket");
    }
  }



  dispatch(socket) {
    if (this.isFanout) return;
    if (this.jobs.length < 1) return
    if (!socket) return;

    let jobsToProcess = []
    const activeJobs = this.activeJobs.get(socket.id) || [];
    if (socket.prefetchCount) {
      const availableSlots = socket.prefetchCount - activeJobs.length;
      if (availableSlots <= 0) return;
      jobsToProcess = this.jobs.splice(0, availableSlots); // Take the first `availableSlots` jobs
    } else {
      jobsToProcess = this.jobs.slice();
      this.jobs.length = 0;
    }

    if (jobsToProcess.length < 1) {
      return
    }

    try {
      socket.send(JSON.stringify({ type: 'job', data: jobsToProcess, }));
    } catch (err) {
      console.error("Failed to send job:", err);
    }

    activeJobs.push(...jobsToProcess);

    this.activeJobs.set(socket.id, activeJobs);

    if (this.jobs.length > 0) {
      setImmediate(() => {
        this.dispatch(socket)
      });
    }
  }

}

module.exports = MessageQueue;
