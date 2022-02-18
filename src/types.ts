export interface InputVariables {
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  PDF?: string
}

export interface OutputVariables {
  dateSent: string
}

export interface CustomHeaders {
    subject: string
    message: string
    pdfName : string
}
