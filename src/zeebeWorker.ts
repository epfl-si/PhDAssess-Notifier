import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import __ from 'lodash'
import debug_ from 'debug'
import {InputVariables, CustomHeaders, OutputVariables} from "./types"
import Mustache from "mustache"
import {encrypt, decryptVariables} from "./encryption"
import {epflTransporter, etherealTransporter} from "./transporters";
import {getTestMessageUrl} from "nodemailer";
import {Attachment} from "nodemailer/lib/mailer";

const debug = debug_('phd-assess-notifier/zeebeWorker')
const smtpDebug = debug_('phd-assess-notifier/SMTP')

export const zBClient = new ZBClient({
  "pollInterval": Duration.seconds.of(15),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

const handler: ZBWorkerTaskHandler<InputVariables, CustomHeaders, OutputVariables> = async (
  job,
  _,
  worker
  ) => {

  console.log("Received and starting task", {
      taskType,
      job: __.omit(job, 'customHeaders')
  })

  const jobVariables: InputVariables = decryptVariables(job)

  debug(`Checking task validity...`)
  let whatsMissingDescription: string[] = []
  if (!job.customHeaders.subject)
    whatsMissingDescription.push('job custom headers has no "subject"')
  if (!job.customHeaders.message)
    whatsMissingDescription.push('job custom headers has no "message"')
  if (!jobVariables.to)
    whatsMissingDescription.push('job variables has no "to"')

  if (whatsMissingDescription.length > 0) {
    debug(`Job variables : ${jobVariables}`)
    debug(`Job custom headers : ${job.customHeaders}`)
    worker.log(`Failing the job without any retry because ${whatsMissingDescription}.
     Fix the workflow BPMN version n. ${job.workflowDefinitionVersion}, step ${job.elementId}`)
    return job.error('unexpected BPMN variables', whatsMissingDescription.join(', '))
  } else {
    debug(`Task has pass the validity, continuing`)

    const renderedSubject = Mustache.render(job.customHeaders.subject, jobVariables)
    const renderedMessage = Mustache.render(job.customHeaders.message, jobVariables)

    debug(`Building the email info (rendering content, filling addresses, ...`)

    let attachments: Attachment[] = []

    if (jobVariables.PDF) {
      attachments.push({
        filename: `phd_annual_report_${job.key}.pdf`,
        content: jobVariables.PDF,
        encoding: 'base64',
      })
    }

    const emailInfo  = {
      from: process.env.NOTIFIER_FROM_ADDRESS || "Annual report <noreply@epfl.ch>",
      to: jobVariables.to,
      cc: jobVariables.cc,
      bcc: jobVariables.bcc,
      subject: renderedSubject,
      html: renderedMessage,
      attachments: attachments
    }

    if (process.env.NOTIFIER_HOST && process.env.NOTIFIER_HOST.endsWith('epfl.ch')) {
      smtpDebug(`Using EPFL mail service to send the email`)
      let info = await epflTransporter.sendMail(emailInfo)
      smtpDebug(`SMTP server returned: ${info.response}`)
    } else {
      if (process.env.ETHEREAL_USERNAME) {
        smtpDebug(`Using ethereal mail service to send the email`)
        const etherealMail = await etherealTransporter()
        let info = await etherealMail.sendMail(emailInfo);

        smtpDebug("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", getTestMessageUrl(info));
      } else {
        const errorMsg = `Unable to send this email, look like the env NOTIFIER_HOST is wrongly configured, or Ethereal auths are wrongly configured`
        console.error(errorMsg)
        return job.fail(errorMsg)
      }
    }

    // AfterTask worker business logic goes here
    debug(`Completing and updating the process instance, adding dateSent as output variables`)
    const updateBrokerVariables = {
      dateSent: encrypt(new Date().toJSON()),
    }
    return job.complete(updateBrokerVariables)
  }
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
  console.log(`worker started, awaiting for ${taskType} jobs...`)
}
