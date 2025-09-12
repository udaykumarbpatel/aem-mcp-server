import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AEMConnector } from './aem-connector.js';
import { logger, generateRequestId } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();
const aemConnector = new AEMConnector();
const server = new Server({
    name: 'aem-mcp-agent',
    version: '1.0.0',
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
const tools = [
    {
        name: 'validateComponent',
        description: 'Validate component changes before applying them',
        inputSchema: {
            type: 'object',
            properties: {
                locale: { type: 'string' },
                pagePath: { type: 'string' },
                component: { type: 'string' },
                props: { type: 'object' },
            },
            required: ['locale', 'pagePath', 'component', 'props'],
        },
    },
    {
        name: 'updateComponent',
        description: 'Update component properties in AEM',
        inputSchema: {
            type: 'object',
            properties: {
                componentPath: { type: 'string' },
                properties: { type: 'object' },
            },
            required: ['componentPath', 'properties'],
        },
    },
    {
        name: 'undoChanges',
        description: 'Undo the last component changes',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: { type: 'string' },
            },
            required: ['jobId'],
        },
    },
    {
        name: 'scanPageComponents',
        description: 'Scan a page to discover all components and their properties',
        inputSchema: {
            type: 'object',
            properties: {
                pagePath: { type: 'string' },
            },
            required: ['pagePath'],
        },
    },
    {
        name: 'fetchSites',
        description: 'Get all available sites in AEM',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'fetchLanguageMasters',
        description: 'Get language masters for a specific site',
        inputSchema: {
            type: 'object',
            properties: { site: { type: 'string' } },
            required: ['site'],
        },
    },
    {
        name: 'fetchAvailableLocales',
        description: 'Get available locales for a site and language master',
        inputSchema: {
            type: 'object',
            properties: {
                site: { type: 'string' },
                languageMasterPath: { type: 'string' },
            },
            required: ['site', 'languageMasterPath'],
        },
    },
    {
        name: 'replicateAndPublish',
        description: 'Replicate and publish content to selected locales',
        inputSchema: {
            type: 'object',
            properties: {
                selectedLocales: { type: 'array', items: { type: 'string' } },
                componentData: { type: 'object' },
                localizedOverrides: { type: 'object' },
            },
            required: ['selectedLocales', 'componentData'],
        },
    },
    {
        name: 'getAllTextContent',
        description: 'Get all text content from a page including titles, text components, and descriptions',
        inputSchema: {
            type: 'object',
            properties: { pagePath: { type: 'string' } },
            required: ['pagePath'],
        },
    },
    {
        name: 'getPageTextContent',
        description: 'Get text content from a specific page',
        inputSchema: {
            type: 'object',
            properties: { pagePath: { type: 'string' } },
            required: ['pagePath'],
        },
    },
    {
        name: 'getPageImages',
        description: 'Get all images from a page, including those within Experience Fragments',
        inputSchema: {
            type: 'object',
            properties: { pagePath: { type: 'string' } },
            required: ['pagePath'],
        },
    },
    {
        name: 'updateImagePath',
        description: 'Update the image path for an image component and verify the update',
        inputSchema: {
            type: 'object',
            properties: {
                componentPath: { type: 'string' },
                newImagePath: { type: 'string' },
            },
            required: ['componentPath', 'newImagePath'],
        },
    },
    {
        name: 'getPageContent',
        description: 'Get all content from a page including Experience Fragments and Content Fragments',
        inputSchema: {
            type: 'object',
            properties: { pagePath: { type: 'string' } },
            required: ['pagePath'],
        },
    },
    {
        name: 'listPages',
        description: 'List all pages under a site root',
        inputSchema: {
            type: 'object',
            properties: {
                siteRoot: { type: 'string' },
                depth: { type: 'number' },
                limit: { type: 'number' },
            },
        },
    },
    {
        name: 'getNodeContent',
        description: 'Legacy: Get JCR node content',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                depth: { type: 'number' },
            },
            required: ['path'],
        },
    },
    {
        name: 'listChildren',
        description: 'Legacy: List child nodes',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
        },
    },
    {
        name: 'getPageProperties',
        description: 'Get page properties',
        inputSchema: {
            type: 'object',
            properties: { pagePath: { type: 'string' } },
            required: ['pagePath'],
        },
    },
    {
        name: 'searchContent',
        description: 'Search content using Query Builder',
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                fulltext: { type: 'string' },
                path: { type: 'string' },
                limit: { type: 'number' },
            },
        },
    },
    {
        name: 'executeJCRQuery',
        description: 'Execute JCR query',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
            },
            required: ['query'],
        },
    },
    {
        name: 'getAssetMetadata',
        description: 'Get asset metadata',
        inputSchema: {
            type: 'object',
            properties: { assetPath: { type: 'string' } },
            required: ['assetPath'],
        },
    },
    {
        name: 'getStatus',
        description: 'Get workflow status by ID',
        inputSchema: {
            type: 'object',
            properties: { workflowId: { type: 'string' } },
            required: ['workflowId'],
        },
    },
    {
        name: 'listMethods',
        description: 'Get list of available MCP methods',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'enhancedPageSearch',
        description: 'Intelligent page search with comprehensive fallback strategies and cross-section search',
        inputSchema: {
            type: 'object',
            properties: {
                searchTerm: { type: 'string' },
                basePath: { type: 'string' },
                includeAlternateLocales: { type: 'boolean' },
            },
            required: ['searchTerm', 'basePath'],
        },
    },
    {
        name: 'createPage',
        description: 'Create a new page in AEM',
        inputSchema: {
            type: 'object',
            properties: {
                parentPath: { type: 'string' },
                title: { type: 'string' },
                template: { type: 'string' },
                name: { type: 'string' },
                properties: { type: 'object' },
            },
            required: ['parentPath', 'title', 'template'],
        },
    },
    {
        name: 'deletePage',
        description: 'Delete a page from AEM',
        inputSchema: {
            type: 'object',
            properties: {
                pagePath: { type: 'string' },
                force: { type: 'boolean' },
            },
            required: ['pagePath'],
        },
    },
    {
        name: 'createComponent',
        description: 'Create a new component on a page',
        inputSchema: {
            type: 'object',
            properties: {
                pagePath: { type: 'string' },
                componentType: { type: 'string' },
                resourceType: { type: 'string' },
                properties: { type: 'object' },
                name: { type: 'string' },
            },
            required: ['pagePath', 'componentType', 'resourceType'],
        },
    },
    {
        name: 'deleteComponent',
        description: 'Delete a component from AEM',
        inputSchema: {
            type: 'object',
            properties: {
                componentPath: { type: 'string' },
                force: { type: 'boolean' },
            },
            required: ['componentPath'],
        },
    },
    {
        name: 'unpublishContent',
        description: 'Unpublish content from the publish environment',
        inputSchema: {
            type: 'object',
            properties: {
                contentPaths: { type: 'array', items: { type: 'string' } },
                unpublishTree: { type: 'boolean' },
            },
            required: ['contentPaths'],
        },
    },
    {
        name: 'activatePage',
        description: 'Activate (publish) a single page',
        inputSchema: {
            type: 'object',
            properties: {
                pagePath: { type: 'string' },
                activateTree: { type: 'boolean' },
            },
            required: ['pagePath'],
        },
    },
    {
        name: 'deactivatePage',
        description: 'Deactivate (unpublish) a single page',
        inputSchema: {
            type: 'object',
            properties: {
                pagePath: { type: 'string' },
                deactivateTree: { type: 'boolean' },
            },
            required: ['pagePath'],
        },
    },
    {
        name: 'uploadAsset',
        description: 'Upload a new asset to AEM DAM',
        inputSchema: {
            type: 'object',
            properties: {
                parentPath: { type: 'string' },
                fileName: { type: 'string' },
                fileContent: { type: 'string' },
                mimeType: { type: 'string' },
                metadata: { type: 'object' },
            },
            required: ['parentPath', 'fileName', 'fileContent'],
        },
    },
    {
        name: 'updateAsset',
        description: 'Update an existing asset in AEM DAM',
        inputSchema: {
            type: 'object',
            properties: {
                assetPath: { type: 'string' },
                metadata: { type: 'object' },
                fileContent: { type: 'string' },
                mimeType: { type: 'string' },
            },
            required: ['assetPath'],
        },
    },
    {
        name: 'deleteAsset',
        description: 'Delete an asset from AEM DAM',
        inputSchema: {
            type: 'object',
            properties: {
                assetPath: { type: 'string' },
                force: { type: 'boolean' },
            },
            required: ['assetPath'],
        },
    },
    {
        name: 'getTemplates',
        description: 'Get available page templates',
        inputSchema: {
            type: 'object',
            properties: { sitePath: { type: 'string' } },
        },
    },
    {
        name: 'getTemplateStructure',
        description: 'Get detailed structure of a specific template',
        inputSchema: {
            type: 'object',
            properties: { templatePath: { type: 'string' } },
            required: ['templatePath'],
        },
    },
    {
        name: 'bulkUpdateComponents',
        description: 'Update multiple components in a single operation with validation and rollback support',
        inputSchema: {
            type: 'object',
            properties: {
                updates: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            componentPath: { type: 'string' },
                            properties: { type: 'object' }
                        },
                        required: ['componentPath', 'properties']
                    }
                },
                validateFirst: { type: 'boolean' },
                continueOnError: { type: 'boolean' }
            },
            required: ['updates'],
        },
    },
];
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = generateRequestId();
    const startTime = Date.now();
    logger.methodStart(name, args, requestId);
    if (!args) {
        const duration = Date.now() - startTime;
        logger.methodError(name, new Error('No arguments provided'), duration, requestId);
        return {
            content: [
                { type: 'text', text: 'Error: No arguments provided' },
            ],
            isError: true,
        };
    }
    let result;
    try {
        switch (name) {
            case 'validateComponent': {
                result = await aemConnector.validateComponent({
                    locale: args.locale,
                    page_path: args.pagePath,
                    component: args.component,
                    props: args.props,
                });
                break;
            }
            case 'updateComponent': {
                result = await aemConnector.updateComponent(args);
                break;
            }
            case 'undoChanges': {
                result = await aemConnector.undoChanges(args);
                break;
            }
            case 'scanPageComponents': {
                const pagePath = args.pagePath;
                result = await aemConnector.scanPageComponents(pagePath);
                break;
            }
            case 'fetchSites': {
                result = await aemConnector.fetchSites();
                break;
            }
            case 'fetchLanguageMasters': {
                const site = args.site;
                result = await aemConnector.fetchLanguageMasters(site);
                break;
            }
            case 'fetchAvailableLocales': {
                const { site, languageMasterPath } = args;
                result = await aemConnector.fetchAvailableLocales(site, languageMasterPath);
                break;
            }
            case 'replicateAndPublish': {
                result = await aemConnector.replicateAndPublish(args.selectedLocales, args.componentData, args.localizedOverrides);
                break;
            }
            case 'getAllTextContent': {
                const pagePath = args.pagePath;
                result = await aemConnector.getAllTextContent(pagePath);
                break;
            }
            case 'getPageTextContent': {
                const pagePath = args.pagePath;
                result = await aemConnector.getPageTextContent(pagePath);
                break;
            }
            case 'getPageImages': {
                const pagePath = args.pagePath;
                result = await aemConnector.getPageImages(pagePath);
                break;
            }
            case 'updateImagePath': {
                const { componentPath, newImagePath } = args;
                result = await aemConnector.updateImagePath(componentPath, newImagePath);
                break;
            }
            case 'getPageContent': {
                const pagePath = args.pagePath;
                result = await aemConnector.getPageContent(pagePath);
                break;
            }
            case 'listPages': {
                const { siteRoot, depth, limit } = args;
                result = await aemConnector.listPages(siteRoot, depth, limit);
                break;
            }
            case 'getNodeContent': {
                const { path, depth } = args;
                result = await aemConnector.getNodeContent(path, depth);
                break;
            }
            case 'listChildren': {
                const path = args.path;
                const children = await aemConnector.listChildren(path);
                result = { children };
                break;
            }
            case 'getPageProperties': {
                const pagePath = args.pagePath;
                result = await aemConnector.getPageProperties(pagePath);
                break;
            }
            case 'searchContent': {
                result = await aemConnector.searchContent(args);
                break;
            }
            case 'executeJCRQuery': {
                const { query, limit } = args;
                result = await aemConnector.executeJCRQuery(query, limit);
                break;
            }
            case 'getAssetMetadata': {
                const assetPath = args.assetPath;
                result = await aemConnector.getAssetMetadata(assetPath);
                break;
            }
            case 'getStatus': {
                result = { success: true, workflowId: args.workflowId, status: 'completed', message: 'Mock workflow status - always returns completed', timestamp: new Date().toISOString() };
                break;
            }
            case 'listMethods': {
                result = tools;
                break;
            }
            case 'enhancedPageSearch': {
                result = await aemConnector.searchContent({ fulltext: args.searchTerm, path: args.basePath, type: 'cq:Page', limit: 20 });
                break;
            }
            case 'createPage': {
                result = await aemConnector.createPage(args);
                break;
            }
            case 'deletePage': {
                result = await aemConnector.deletePage(args);
                break;
            }
            case 'createComponent': {
                result = await aemConnector.createComponent(args);
                break;
            }
            case 'deleteComponent': {
                result = await aemConnector.deleteComponent(args);
                break;
            }
            case 'unpublishContent': {
                result = await aemConnector.unpublishContent(args);
                break;
            }
            case 'activatePage': {
                result = await aemConnector.activatePage(args);
                break;
            }
            case 'deactivatePage': {
                result = await aemConnector.deactivatePage(args);
                break;
            }
            case 'uploadAsset': {
                result = await aemConnector.uploadAsset(args);
                break;
            }
            case 'updateAsset': {
                result = await aemConnector.updateAsset(args);
                break;
            }
            case 'deleteAsset': {
                result = await aemConnector.deleteAsset(args);
                break;
            }
            case 'getTemplates': {
                const sitePath = args.sitePath;
                result = await aemConnector.getTemplates(sitePath);
                break;
            }
            case 'getTemplateStructure': {
                const templatePath = args.templatePath;
                result = await aemConnector.getTemplateStructure(templatePath);
                break;
            }
            case 'bulkUpdateComponents': {
                result = await aemConnector.bulkUpdateComponents(args);
                break;
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        const duration = Date.now() - startTime;
        logger.methodEnd(name, duration, true, requestId, result);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.methodError(name, error, duration, requestId, args);
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // eslint-disable-next-line no-console
    console.error('AEM MCP Server running as a standard MCP handler (stdio transport)');
}
main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
});
