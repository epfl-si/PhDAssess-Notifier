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
import {mergePDFs} from "./utils"
import {NotificationLog, NotificationType} from "phd-assess-meta/types/notification";
const version = require('./version.js');
import {fetchFileAsBase64, fetchTicket} from "phdassess-ged-connector";


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
          'variables.fromElementId',
        ]
      ),
      hasPDFString: !!job.variables.PDF,
      hasPDFAnnexPath: !!job.variables.pdfAnnexPath,
      wantPDFName: job.customHeaders.pdfName,
  })

  const jobVariables: InputVariables = decryptVariables(job, alreadyDecryptedVariables)

  // subject and message can come from two sources, as customHeader, or as variable.
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
    let generatedPDF = jobVariables.PDF ?? ''

    if (generatedPDF) {
      // check the need to download an annex before attaching the provided PDF
      if (jobVariables.pdfAnnexPath) {
        const ticket = await fetchTicket({
          serverUrl: process.env.ALFRESCO_URL!,
          username: process.env.ALFRESCO_USERNAME!,
          password: process.env.ALFRESCO_PASSWORD!,
        })

        const pdfAsBase64 = await fetchFileAsBase64(
          jobVariables.pdfAnnexPath,
          ticket,
        )
        // merge the two
        generatedPDF = await mergePDFs(generatedPDF, pdfAsBase64)
      }

      attachments.push({
        filename: fileName,
        content: generatedPDF,
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

    /*
     * By default, without a 'type' defined, we have not a reminder, but a pending notification.
     * Reminders can come in two ways, depending on the version of the workflow used. In 'type' or in
     * fromElementId, ending with '_reminder'
     */
    // can be empty, if coming from the bpmn directly instead of a zeebe publish message
    let fromElementId = jobVariables.fromElementId ?? 'unknown_source'
    let type: NotificationType = jobVariables.type ?? 'awaitingForm'

    if (fromElementId.endsWith('_reminder')) {
      fromElementId = fromElementId.substring(0, fromElementId.indexOf( '_reminder'))
      type = 'reminder'
    }

    const notificationLog: NotificationLog = {
      sentAt: new Date().toJSON(),
      sentTo: {
        to: recipients.to,
        cc: recipients.cc ?? undefined,
        bcc: recipients.bcc ?? undefined,
      },
      fromElementId: fromElementId,
      type: type,
    }

    const updateBrokerVariables = {
      sentLog: encrypt(JSON.stringify(notificationLog)) as string
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
