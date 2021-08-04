import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'

const debug = debug_('phd-assess/zeebeWorker')

const zBClient = new ZBClient({
  pollInterval: Duration.seconds.of(10),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

const handler: ZBWorkerTaskHandler = async (
  job,
  _,
  worker
  ) => {
  worker.log(`Task variables ${job.variables}`)
  debug(`Zeebe worker "${taskType}" started`);

  // AfterTask worker business logic goes here
  const updateBrokerVariables = {
    dateSent: 'newValue',
  }
  return job.complete(updateBrokerVariables)
}

export const startWorker = () => {
  console.log("starting worker")
  return zBClient.createWorker({
    taskType: taskType,
    maxJobsToActivate: 5,
    // Set timeout, the same as we will ask yourself if the job is still up
    timeout: Duration.milliseconds.of(5),
    // load every job into the in-memory server db
    taskHandler: handler
  })
}

startWorker()
