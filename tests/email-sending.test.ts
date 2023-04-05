import {Attachment, Headers} from "nodemailer/lib/mailer";
import {getTestMessageUrl} from "nodemailer";
import 'mocha'
import {assert} from "chai";
import {sendMail as etherealSendMail} from "../src/transporters/ethereal";

const chai = require('chai')
chai.use(require('chai-fs'))


describe('Send email tests', () => {
  it('should add the additional "filename" in the header of the message', async () => {
    // 1. ARRANGE
    const message = `Some lambda message`
    const fileName = "PROVISIONAL_phd_annual_report_notapproved_Marcel_Rimboz_Delacroix_166534_2022-2-21.pdf"
    const smallPDF = "JVBERi0xLjIgCjkgMCBvYmoKPDwKPj4Kc3RyZWFtCkJULyA5IFRmKFRlc3QpJyBFVAplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgovQ29udGVudHMgOSAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0tpZHMgWzQgMCBSIF0KL0NvdW50IDEKL1R5cGUgL1BhZ2VzCi9NZWRpYUJveCBbIDAgMCA5OSA5IF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1BhZ2VzIDUgMCBSCi9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDMgMCBSCj4+CiUlRU9GCg=="

    let attachments: Attachment[] = [{
      filename: fileName,
      content: smallPDF,
      encoding: 'base64',
      headers: {'filename': fileName} as Headers
    }]

    const emailInfo  = {
      from: "nope@nope.no",
      to: process.env.ETHEREAL_USERNAME || "casandra.greenfelder@ethereal.email",
      subject: "testing filename",
      html: message,
      attachments: attachments
    }

    // 2. ACT
    let info = await etherealSendMail(emailInfo)

    // 3. ASSERT
    assert(info)
    console.dir(info)
    console.log("Preview URL: %s", getTestMessageUrl(info));
    console.log('Please check the result manually with the provided Preview URL. You should find a "filename" for the attachment');
  })
})
