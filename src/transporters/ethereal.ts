import {createTransport, createTestAccount, SendMailOptions} from "nodemailer";
import * as Process from "process";


// make auth info persistant in memory, validity test is done at sending
let etherealUsername: string | null, etherealPassword: string | null = null

// create reusable transporter object using the default SMTP transport
const etherealTransporter = async () => {
  if (!etherealUsername || !etherealPassword) await generateAccount()

  return createTransport({
    host: process.env.NOTIFIER_HOST || "smtp.ethereal.email",
    port: Number(process.env.NOTIFIER_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: etherealUsername!,
      pass: etherealPassword!
    }
  });
}

const generateAccount = async () => {
  let testAccount = await createTestAccount();
  etherealUsername = testAccount.user // generated ethereal user
  etherealPassword = testAccount.pass // generated ethereal password
  console.log(`New ethereal account created: user: ${etherealUsername}, password: ${etherealPassword}`)
}

export const sendMail = async (emailInfo: SendMailOptions) => {
  let etherealMail = await etherealTransporter()

  try {
    await etherealMail.verify()
  } catch (error) {
    // dependent on the error, recreating a new test account may do the job
    etherealUsername = null
    etherealPassword = null
    let etherealMail = await etherealTransporter()
    await etherealMail.verify()
  }

  // if we got here, it means we should be ready to send the email
  return await etherealMail.sendMail(emailInfo);
}
