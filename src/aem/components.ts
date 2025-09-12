import { aemClient } from './client.js';

export const validateComponent = (params: any) => aemClient.validateComponent(params);
export const updateComponent = (params: any) => aemClient.updateComponent(params);
export const undoChanges = (params: any) => aemClient.undoChanges(params);
export const scanPageComponents = (pagePath: string) => aemClient.scanPageComponents(pagePath);
export const updateImagePath = (componentPath: string, newImagePath: string) => aemClient.updateImagePath(componentPath, newImagePath);
export const createComponent = (params: any) => aemClient.createComponent(params);
export const deleteComponent = (params: any) => aemClient.deleteComponent(params);
export const bulkUpdateComponents = (params: any) => aemClient.bulkUpdateComponents(params);
