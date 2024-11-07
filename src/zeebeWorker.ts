import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import {InputVariables, CustomHeaders, OutputVariables} from "./types"
import Mustache from "mustache"
import {encrypt, decryptVariables} from "./encryption"
import {getTestMessageUrl, SendMailOptions} from "nodemailer";
import {Attachment, Headers} from "nodemailer/lib/mailer";
import {flatPick, stringToNotEmptyArrayString} from "./utils";
import {epflTransporter} from "./transporters/epfl";
import {sendMail as etherealSendMail} from "./transporters/ethereal";
import {NotificationLog} from "phd-assess-meta/types/notification";
const version = require('./version.js');

const debug = debug_('phd-assess-notifier/zeebeWorker')
const smtpDebug = debug_('phd-assess-notifier/SMTP')

export const zBClient = new ZBClient({
  "pollInterval": Duration.seconds.of(15),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

// list which variables are not encrypted.
const alreadyDecryptedVariables = [
  'dashboardDefinition',
  'uuid',
]

const handler: ZBWorkerTaskHandler<InputVariables, CustomHeaders, OutputVariables> = async (
  job
  ) => {

  console.log("Received and starting task", {
      taskType,
      job: flatPick(job,
        [
          'key',
          'processInstanceKey',
          'processDefinitionVersion',
          'elementId',
          'worker',
          'variables.created_at',
          'variables.created_by',
          'variables.to',
          'variables.cc',
          'variables.bcc',
          'variables.type',
        ]
      )
  })

  const jobVariables: InputVariables = decryptVariables(job, alreadyDecryptedVariables)

  // subject and message can come from two source, as customHeader, or as variable.
  // When the data comes from customHeader, it has the priority. Mainly used in old workflows.
  const subject = job.customHeaders.subject ?? jobVariables.subject
  const message = job.customHeaders.message ?? jobVariables.message

  debug(`Checking task validity...`)
  let whatsMissingDescription: string[] = []
  if (!subject)
    whatsMissingDescription.push('job received has no "subject" entry')
  if (!message)
    whatsMissingDescription.push('job received has no "message" entry')
  if (!jobVariables.to)
    whatsMissingDescription.push('job variables has no "to"')

  if (whatsMissingDescription.length > 0) {
    debug(`Job variables : ${ JSON.stringify(jobVariables) }`)
    debug(`Job custom headers : ${ JSON.stringify(job.customHeaders) }`)
    debug(`Failing the job without any retry because ${whatsMissingDescription}.
     Fix the workflow BPMN version n. ${job.processDefinitionVersion}, step ${job.elementId}`)
    return job.error('unexpected BPMN variables', whatsMissingDescription.join(', '))
  } else {
    debug(`Task has pass the validity, continuing`)

    const renderedSubject = Mustache.render(subject, jobVariables)
    const renderedMessage = Mustache.render(message, jobVariables)

    debug(`Building the email info (rendering content, filling addresses, ...`)

    let attachments: Attachment[] = []

    const today = new Date();
    const currentDay = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`
    const pdfName = job.customHeaders.pdfName ?? jobVariables.pdfName
    const phdStudentName = jobVariables.phdStudentName ?? ''
    const phdStudentSciper= jobVariables.phdStudentSciper ?? ''

    // @ts-ignore
    const fileName = `${pdfName?pdfName+'_':''}${phdStudentName.replace(/\s/g, '_')}_${phdStudentSciper}_${currentDay}.pdf`

    if (jobVariables.PDF) {
      attachments.push({
        filename: fileName,
        content: jobVariables.PDF,
        encoding: 'base64',
        /* add the static "FILENAME", to complete the generated FILENAME* ones that
          are very good but not legacy (yeah for some email readers) */
        headers: {'filename': fileName} as Headers
      })
    }

    const recipients = {
      to: stringToNotEmptyArrayString(jobVariables.to),
      cc: stringToNotEmptyArrayString(jobVariables.cc),
      bcc: stringToNotEmptyArrayString(jobVariables.bcc),
    }

    const emailInfo: SendMailOptions  = {
      from: process.env.NOTIFIER_FROM_ADDRESS || "Annual report <noreply@epfl.ch>",
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: renderedSubject,
      html: renderedMessage,
      attachments: attachments
    }

    if (process.env.NOTIFIER_HOST?.endsWith('epfl.ch')) {
      smtpDebug(`Using EPFL mail service to send the email`)
      let info = await epflTransporter.sendMail(emailInfo)
      smtpDebug(`SMTP server returned: ${info.response}`)
    } else if (process.env.NOTIFIER_HOST === 'smtp.ethereal.email') {
      // when we use ethereal, try to send the mail, first, if it fails, it may mean we need to create the account and retry
      smtpDebug(`Using ethereal mail service to send the email`)
      let info = await etherealSendMail(emailInfo)
      smtpDebug("Message sent: %s", info.messageId);
      console.log("Preview URL: %s", getTestMessageUrl(info));
    } else {
      const errorMsg = `Unable to send this email, look like the env NOTIFIER_HOST is wrongly configured, or Ethereal auths are wrongly configured`
      console.error(errorMsg)
      return job.fail(errorMsg)
    }


    // default means we have not a reminder, but a pending notification
    // reminder can come in two ways, depending on the version of the workflow used
    const notificationType = jobVariables.type ??
      ( jobVariables.fromElementId!.endsWith('_reminder') ) ?
        'reminder' : 'awaitingForm'

    const notificationLog: NotificationLog = {
      sentAt: new Date().toJSON(),
      sentTo: {
        to: recipients.to,
        cc: recipients.cc,
        bcc: recipients.bcc,
      },
      fromElementId: jobVariables.fromElementId!,
      type: notificationType,
    }

    const updateBrokerVariables = {
      sentLog: encrypt(JSON.stringify(notificationLog))
    }

    debug(`Completing and updating the process instance variables with a notification log.`)

    return job.complete(updateBrokerVariables)
  }
}

export const startWorker = () => {
  console.log(`starting phd-assess-notifier version ${version}...`)
  console.log("starting worker...")

  const worker = zBClient.createWorker({
    taskType: taskType,
    maxJobsToActivate: 5,
    // Set timeout, the same as we will ask yourself if the job is still up
    timeout: Duration.minutes.of(2),
    // load every job into the in-memory server db
    taskHandler: handler,
  })

  console.log(`worker started, awaiting for ${taskType} jobs...`)
  return worker
}
