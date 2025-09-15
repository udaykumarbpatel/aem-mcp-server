import { aemClient } from './client.js';

export const startWorkflow = (params: any) => aemClient.startWorkflow(params);
export const getWorkflowStatus = (workflowId: string) => aemClient.getWorkflowStatus(workflowId);
