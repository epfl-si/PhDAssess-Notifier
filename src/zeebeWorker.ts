import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import {InputVariables, CustomHeaders, OutputVariables} from "./types"
import Mustache from "mustache"
import {encrypt, decryptVariables} from "./encryption"
import {epflTransporter, etherealTransporter} from "./transporters";
import {getTestMessageUrl} from "nodemailer";

const debug = debug_('phd-assess-notifier/zeebeWorker')
const smtpDebug = debug_('phd-assess-notifier/SMTP')

export const zBClient = new ZBClient({
  pollInterval: Duration.seconds.of(15),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

const handler: ZBWorkerTaskHandler<InputVariables, CustomHeaders, OutputVariables> = async (
  job,
  _,
  worker
  ) => {
  worker.debug(`Received and starting the ${taskType} job ${job.key}`)
  const jobVariables: InputVariables = decryptVariables(job.variables)

  debug(`Checking task validity...`)
  if (!job.customHeaders.message) worker.log(`Task step has no messages. Fix the BPMN`)
  debug(`Task seems valid, continuing`)

  const renderedMessage = Mustache.render(job.customHeaders.message, jobVariables);

  debug(`Building the email info (rendering content, filling addresses, ...`)
  // TODO: fill to and cc with addresses (aka input parameters)
  const emailInfo  = {
    from: process.env.NOTIFIER_FROM_ADDRESS || "noreply@epfl.ch",
    to: ["bar@example.com", "baz@example.com"],
    cc: "bar@example.com",
    subject: job.customHeaders.subject,
    html: renderedMessage,
  }

  smtpDebug(`Choosing the transporter to send the email`)
  if (process.env.ETHEREAL_USERNAME) {
    smtpDebug(`Using ethereal mail service to send the email`)
    const etherealMail = await etherealTransporter()
    let info = await etherealMail.sendMail(emailInfo);

    smtpDebug("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", getTestMessageUrl(info));
  } else {
    smtpDebug(`Using EPFL mail service to send the email`)
    let info = await epflTransporter.sendMail(emailInfo)
    smtpDebug(`SMTP server returned: ${info.response}`)
  }

  // AfterTask worker business logic goes here
  debug(`Completing and updating the process instance with dateSent`)
  const updateBrokerVariables = {
    dateSent: encrypt(new Date().toJSON()),
  }
  return job.complete(updateBrokerVariables)
}

export const startWorker = () => {
  console.log("starting worker")
  zBClient.createWorker({
    taskType: taskType,
    maxJobsToActivate: 5,
    // Set timeout, the same as we will ask yourself if the job is still up
    timeout: Duration.minutes.of(2),
    // load every job into the in-memory server db
    taskHandler: handler
  })
  console.log(`worker started`)
}
