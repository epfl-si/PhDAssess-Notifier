import {createTransport} from "nodemailer";


export const epflTransporter = createTransport({
  host: process.env.NOTIFIER_HOST,
  port: Number(process.env.NOTIFIER_PORT)
})
