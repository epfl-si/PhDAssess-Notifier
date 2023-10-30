import {NotificationStartMessage} from "phd-assess-meta/types/notification";

export interface InputVariables extends NotificationStartMessage{
  PDF?: string  // base64 string
  phdStudentName?: string  // useful to build a nice pdf name
  phdStudentSciper?: string  // useful to build a nice pdf name
  created_at?: string
  created_by?: string
}

export interface OutputVariables {
  sentLog: string  // a notification log encrypted
}

export interface CustomHeaders {
  subject: string
  message: string
  pdfName?: string
}
