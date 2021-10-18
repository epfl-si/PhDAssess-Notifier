export interface InputVariables {
  to?: string
  cc?: string
  bcc?: string
  PDF?: string
}

export interface OutputVariables {
  dateSent: string
}

export interface CustomHeaders {
    subject: string
    message: string
}
