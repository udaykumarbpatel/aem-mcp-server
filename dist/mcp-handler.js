import * as components from './aem/components.js';
import * as pages from './aem/pages.js';
import * as assets from './aem/assets.js';
import { categorizeMethod } from './utils/method-categorizer.js';
export class MCPRequestHandler {
    constructor() { }
    async handleRequest(method, params) {
        try {
            switch (method) {
                case 'validateComponent':
                    return await components.validateComponent(params);
                case 'updateComponent':
                    return await components.updateComponent(params);
                case 'undoChanges':
                    return await components.undoChanges(params);
                case 'scanPageComponents':
                    return await components.scanPageComponents(params.pagePath);
                case 'fetchSites':
                    return await pages.fetchSites();
                case 'fetchLanguageMasters':
                    return await pages.fetchLanguageMasters(params.site);
                case 'fetchAvailableLocales':
                    return await pages.fetchAvailableLocales(params.site, params.languageMasterPath);
                case 'replicateAndPublish':
                    return await pages.replicateAndPublish(params.selectedLocales, params.componentData, params.localizedOverrides);
                case 'getAllTextContent':
                    return await pages.getAllTextContent(params.pagePath);
                case 'getPageTextContent':
                    return await pages.getPageTextContent(params.pagePath);
                case 'getPageImages':
                    return await pages.getPageImages(params.pagePath);
                case 'updateImagePath':
                    return await components.updateImagePath(params.componentPath, params.newImagePath);
                case 'getPageContent':
                    return await pages.getPageContent(params.pagePath);
                case 'listPages':
                    return await pages.listPages(params.siteRoot || params.path || '/content', params.depth || 1, params.limit || 20);
                case 'getNodeContent':
                    return await pages.getNodeContent(params.path, params.depth || 1);
                case 'listChildren':
                    return await pages.listChildren(params.path);
                case 'getPageProperties':
                    return await pages.getPageProperties(params.pagePath);
                case 'searchContent':
                    return await pages.searchContent(params);
                case 'executeJCRQuery':
                    return await pages.executeJCRQuery(params.query, params.limit);
                case 'getAssetMetadata':
                    return await assets.getAssetMetadata(params.assetPath);
                case 'getStatus':
                    return this.getWorkflowStatus(params.workflowId);
                case 'listMethods':
                    return { methods: this.getAvailableMethods() };
                case 'enhancedPageSearch':
                    return await pages.searchContent({
                        fulltext: params.searchTerm,
                        path: params.basePath,
                        type: 'cq:Page',
                        limit: 20
                    });
                case 'createPage':
                    return await pages.createPage(params);
                case 'deletePage':
                    return await pages.deletePage(params);
                case 'createComponent':
                    return await components.createComponent(params);
                case 'deleteComponent':
                    return await components.deleteComponent(params);
                case 'unpublishContent':
                    return await pages.unpublishContent(params);
                case 'activatePage':
                    return await pages.activatePage(params);
                case 'deactivatePage':
                    return await pages.deactivatePage(params);
                case 'uploadAsset':
                    return await assets.uploadAsset(params);
                case 'updateAsset':
                    return await assets.updateAsset(params);
                case 'deleteAsset':
                    return await assets.deleteAsset(params);
                case 'getTemplates':
                    return await pages.getTemplates(params.sitePath);
                case 'getTemplateStructure':
                    return await pages.getTemplateStructure(params.templatePath);
                case 'bulkUpdateComponents':
                    return await components.bulkUpdateComponents(params);
                default:
                    throw new Error(`Unknown method: ${method}`);
            }
        }
        catch (error) {
            return { error: error.message, method, params };
        }
    }
    getWorkflowStatus(workflowId) {
        return {
            success: true,
            workflowId: workflowId,
            status: 'completed',
            message: 'Mock workflow status - always returns completed',
            timestamp: new Date().toISOString()
        };
    }
    getAvailableMethods() {
        const methods = [
            { name: 'validateComponent', description: 'Validate component changes before applying them', parameters: ['locale', 'page_path', 'component', 'props'] },
            { name: 'updateComponent', description: 'Update component properties in AEM', parameters: ['componentPath', 'properties'] },
            { name: 'undoChanges', description: 'Undo the last component changes', parameters: ['job_id'] },
            { name: 'scanPageComponents', description: 'Scan a page to discover all components and their properties', parameters: ['pagePath'] },
            { name: 'fetchSites', description: 'Get all available sites in AEM', parameters: [] },
            { name: 'fetchLanguageMasters', description: 'Get language masters for a specific site', parameters: ['site'] },
            { name: 'fetchAvailableLocales', description: 'Get available locales for a site and language master', parameters: ['site', 'languageMasterPath'] },
            { name: 'replicateAndPublish', description: 'Replicate and publish content to selected locales', parameters: ['selectedLocales', 'componentData', 'localizedOverrides'] },
            { name: 'getAllTextContent', description: 'Get all text content from a page including titles, text components, and descriptions', parameters: ['pagePath'] },
            { name: 'getPageTextContent', description: 'Get text content from a specific page', parameters: ['pagePath'] },
            { name: 'getPageImages', description: 'Get all images from a page, including those within Experience Fragments', parameters: ['pagePath'] },
            { name: 'updateImagePath', description: 'Update the image path for an image component and verify the update', parameters: ['componentPath', 'newImagePath'] },
            { name: 'getPageContent', description: 'Get all content from a page including Experience Fragments and Content Fragments', parameters: ['pagePath'] },
            { name: 'listPages', description: 'List all pages under a site root', parameters: ['siteRoot', 'depth', 'limit'] },
            { name: 'getNodeContent', description: 'Legacy: Get JCR node content', parameters: ['path', 'depth'] },
            { name: 'listChildren', description: 'Legacy: List child nodes', parameters: ['path'] },
            { name: 'getPageProperties', description: 'Get page properties', parameters: ['pagePath'] },
            { name: 'searchContent', description: 'Search content using Query Builder', parameters: ['type', 'fulltext', 'path', 'limit'] },
            { name: 'executeJCRQuery', description: 'Execute JCR query', parameters: ['query', 'limit'] },
            { name: 'getAssetMetadata', description: 'Get asset metadata', parameters: ['assetPath'] },
            { name: 'getStatus', description: 'Get workflow status by ID', parameters: ['workflowId'] },
            { name: 'listMethods', description: 'Get list of available MCP methods', parameters: [] },
            { name: 'enhancedPageSearch', description: 'Intelligent page search with comprehensive fallback strategies and cross-section search', parameters: ['searchTerm', 'basePath', 'includeAlternateLocales'] },
            { name: 'createPage', description: 'Create a new page in AEM', parameters: ['parentPath', 'title', 'template', 'name', 'properties'] },
            { name: 'deletePage', description: 'Delete a page from AEM', parameters: ['pagePath', 'force'] },
            { name: 'createComponent', description: 'Create a new component on a page', parameters: ['pagePath', 'componentType', 'resourceType', 'properties', 'name'] },
            { name: 'deleteComponent', description: 'Delete a component from AEM', parameters: ['componentPath', 'force'] },
            { name: 'unpublishContent', description: 'Unpublish content from the publish environment', parameters: ['contentPaths', 'unpublishTree'] },
            { name: 'activatePage', description: 'Activate (publish) a single page', parameters: ['pagePath', 'activateTree'] },
            { name: 'deactivatePage', description: 'Deactivate (unpublish) a single page', parameters: ['pagePath', 'deactivateTree'] },
            { name: 'uploadAsset', description: 'Upload a new asset to AEM DAM', parameters: ['parentPath', 'fileName', 'fileContent', 'mimeType', 'metadata'] },
            { name: 'updateAsset', description: 'Update an existing asset in AEM DAM', parameters: ['assetPath', 'metadata', 'fileContent', 'mimeType'] },
            { name: 'deleteAsset', description: 'Delete an asset from AEM DAM', parameters: ['assetPath', 'force'] },
            { name: 'getTemplates', description: 'Get available page templates', parameters: ['sitePath'] },
            { name: 'getTemplateStructure', description: 'Get detailed structure of a specific template', parameters: ['templatePath'] },
            { name: 'bulkUpdateComponents', description: 'Update multiple components in a single operation with validation and rollback support', parameters: ['updates', 'validateFirst', 'continueOnError'] },
        ];
        return methods.map(m => ({ ...m, category: categorizeMethod(m.name) }));
    }
}
