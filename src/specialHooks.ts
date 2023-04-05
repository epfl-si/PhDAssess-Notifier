/**
 * Here we have some "quickfix" when the workflow is wrongly defined on a notification task
 */
import {ZeebeJob} from "zeebe-node";
import {CustomHeaders,  InputVariables, OutputVariables, ZeebeJobWriteable} from "./types";


const specialHooks = (job: any) => {
  /**
  * For: Activity_Notify_Thesis_Codirector_PhDStudent_Filled
  * Workflow version: 9 and 10
  * Need: missing "message"
  */

  const jobRedefined: ZeebeJobWriteable = job  // make it writable for typescript

  if (jobRedefined.elementId === 'Activity_Notify_Thesis_Codirector_PhDStudent_Filled' &&
    !jobRedefined.customHeaders.message) {
    jobRedefined.customHeaders.message = `<p>Dear thesis co-Director,</p>  <p>The doctoral student {{ phdStudentName }}, sciper {{ phdStudentSciper }}, you co-supervise has submitted the annual report. Please review the information provided and complete your progress evaluation by logging in via the following link: <a href="https://phd-annual-report.epfl.ch">https://phd-annual-report.epfl.ch</a><br> Please note that once started, the form cannot be saved nor edited. Your progress evaluation is not confidential and will be available to all parties at the time of the collaborative review and once the process is completed.</p>   <p>Then, a meeting will be held between the doctoral student, the thesis director and you as thesis co-Director to review the information, discuss goals achieved and planned, and evaluate overall progress.</p>  <p>On the {{ doctoralProgramName }} doctoral program's webpage, you will find all the useful information for completing the annual report via the tool: <a href="{{ docLinkAnnualReport }}">{{ docLinkAnnualReport }}</a></p>  <p>Should you have any questions, please contact the <a href="mailto:{{ doctoralProgramEmail }}">doctoral program’s administrative office</a>.</p>  <p>Yours faithfully,</p>  <p> {{ programDirectorName }} <br> {{ doctoralProgramName }} doctoral program Director</p>`
  }

  return jobRedefined as Readonly<ZeebeJob<InputVariables, CustomHeaders, OutputVariables>>
}

export default specialHooks;
