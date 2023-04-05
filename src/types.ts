import {ZeebeJob} from "zeebe-node";

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
    pdfName?: string
}

// useful to make a readonly type to writeable, mainly for ZeebeJob
type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type ZeebeJobWriteable = DeepWriteable<ZeebeJob<InputVariables, CustomHeaders, OutputVariables>>
