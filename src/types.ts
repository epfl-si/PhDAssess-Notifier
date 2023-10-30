export interface InputVariables {
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  PDF?: string
  subject?: string
  message?: string
  phdStudentName?: string
  phdStudentSciper?: string
  created_at?: string
  created_by?: string
}

export interface OutputVariables {
  sentLog: {
    sentAt: string
    sentTo: {
      to: string[]
      cc: string[]
      bcc: string[]
    }
    sentElementId: string
  }
}

export interface CustomHeaders {
    subject: string
    message: string
    pdfName?: string
}
