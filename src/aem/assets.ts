import { aemClient } from './client.js';

export const getAssetMetadata = (assetPath: string) => aemClient.getAssetMetadata(assetPath);
export const uploadAsset = (params: any) => aemClient.uploadAsset(params);
export const updateAsset = (params: any) => aemClient.updateAsset(params);
export const deleteAsset = (params: any) => aemClient.deleteAsset(params);
export const activateAsset = (params: any) => aemClient.activateAsset(params);
export const deactivateAsset = (params: any) => aemClient.deactivateAsset(params);
