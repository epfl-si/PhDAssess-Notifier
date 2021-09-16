import {createTransport, createTestAccount} from "nodemailer";
import * as Process from "process";

export const epflTransporter = createTransport({
  host: process.env.NOTIFIER_HOST || "smtp.ethereal.email",
  port: Number(process.env.NOTIFIER_PORT) || 587,
  secure: true, // true for 465, false for other ports
})

// create reusable transporter object using the default SMTP transport
export const etherealTransporter = async () => {
  let authInfo = {
    user: Process.env.ETHEREAL_USERNAME,
    pass: Process.env.ETHEREAL_PASSWORD
  }

  if (!authInfo.user &&
    !authInfo.pass) {
    let testAccount = await createTestAccount();
    authInfo = {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    }
  }

  return createTransport({
    host: process.env.NOTIFIER_HOST || "smtp.ethereal.email",
    port: Number(process.env.NOTIFIER_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: authInfo
  });
}
