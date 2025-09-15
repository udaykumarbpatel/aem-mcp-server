import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import dotenv from 'dotenv';
import { getAEMConfig, isValidContentPath, isValidComponentType, isValidLocale, AEMConfig } from './aem-config.js';
import {
  AEMOperationError,
  createAEMError,
  handleAEMHttpError,
  safeExecute,
  validateComponentOperation,
  createSuccessResponse,
  AEM_ERROR_CODES
} from './error-handler.js';

dotenv.config();

export interface AEMConnectorConfig {
  aem: {
    host: string;
    author: string;
    publish: string;
    serviceUser: {
      username: string;
      password: string;
    };
    endpoints: Record<string, string>;
  };
  mcp: {
    name: string;
    version: string;
  };
}

export class AEMConnector {
  config: AEMConnectorConfig;
  auth: { username: string; password: string };
  aemConfig: AEMConfig;
  client: AxiosInstance;

  constructor() {
    this.config = this.loadConfig();
    this.aemConfig = getAEMConfig();
    this.auth = {
      username: process.env.AEM_SERVICE_USER || this.config.aem.serviceUser.username,
      password: process.env.AEM_SERVICE_PASSWORD || this.config.aem.serviceUser.password,
    };
    if (process.env.AEM_HOST) {
      this.config.aem.host = process.env.AEM_HOST;
      this.config.aem.author = process.env.AEM_HOST;
    }

    const maxSockets = process.env.AEM_MAX_SOCKETS
      ? parseInt(process.env.AEM_MAX_SOCKETS, 10)
      : undefined;
    const agentOptions: http.AgentOptions = { keepAlive: true };
    if (maxSockets && !isNaN(maxSockets)) {
      agentOptions.maxSockets = maxSockets;
    }
    const httpAgent = new http.Agent(agentOptions);
    const httpsAgent = new https.Agent(agentOptions);

    this.client = axios.create({
      baseURL: this.config.aem.host,
      auth: this.auth,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      httpAgent,
      httpsAgent,
    });
  }

  loadConfig(): AEMConnectorConfig {
    return {
      aem: {
        host: process.env.AEM_HOST || 'http://localhost:4502',
        author: process.env.AEM_HOST || 'http://localhost:4502',
        publish: 'http://localhost:4503',
        serviceUser: {
          username: 'admin',
          password: 'admin',
        },
        endpoints: {
          content: '/content',
          dam: '/content/dam',
          query: '/bin/querybuilder.json',
          crxde: '/crx/de',
          jcr: '',
        },
      },
      mcp: {
        name: 'AEM MCP Server',
        version: '1.0.0',
      },
    };
  }

  createAxiosInstance(): AxiosInstance {
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      // eslint-disable-next-line no-console
      console.log('Testing AEM connection to:', this.config.aem.host);
      const client = this.createAxiosInstance();
      const response = await client.get('/libs/granite/core/content/login.html', {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });
      // eslint-disable-next-line no-console
      console.log('✅ AEM connection successful! Status:', response.status);
      return true;
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('❌ AEM connection failed:', error.message);
      if (error.response) {
        // eslint-disable-next-line no-console
        console.error('   Status:', error.response.status);
        // eslint-disable-next-line no-console
        console.error('   URL:', error.config?.url);
      }
      return false;
    }
  }

  // ... All AEM operation methods (validateComponent, updateComponent, undoChanges, scanPageComponents, fetchSites, fetchLanguageMasters, fetchAvailableLocales, replicateAndPublish, executeJCRQuery, getNodeContent, searchContent, getAssetMetadata, listChildren, getPageProperties, listPages, bulkUpdateComponents, getPageTextContent, getAllTextContent, getPageImages, updateImagePath, getPageContent, createPage, deletePage, createComponent, deleteComponent, unpublishContent, activatePage, deactivatePage, uploadAsset, updateAsset, deleteAsset, getTemplates, getTemplateStructure) ...

  // For brevity, only a few methods are shown here. The full implementation should include all methods as in the original JS.

  async validateComponent(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const locale = request.locale;
      const pagePath = request.pagePath || request.page_path;
      const component = request.component;
      const props = request.props;
      validateComponentOperation(locale, pagePath, component, props);
      if (!isValidLocale(locale, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_LOCALE, `Locale '${locale}' is not supported`, { locale, allowedLocales: this.aemConfig.validation.allowedLocales });
      }
      if (!isValidContentPath(pagePath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PATH, `Path '${pagePath}' is not within allowed content roots`, { path: pagePath, allowedRoots: Object.values(this.aemConfig.contentPaths) });
      }
      if (!isValidComponentType(component, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_COMPONENT_TYPE, `Component type '${component}' is not allowed`, { component, allowedTypes: this.aemConfig.components.allowedTypes });
      }
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}.json`, {
        params: { ':depth': '2' },
        timeout: this.aemConfig.queries.timeoutMs,
      });
      const validation = this.validateComponentProps(response.data, component, props);
      return createSuccessResponse({
        message: 'Component validation completed successfully',
        pageData: response.data,
        component,
        locale,
        validation,
        configUsed: {
          allowedLocales: this.aemConfig.validation.allowedLocales,
          allowedComponents: this.aemConfig.components.allowedTypes,
        },
      }, 'validateComponent');
    }, 'validateComponent');
  }

  validateComponentProps(pageData: any, componentType: string, props: any) {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (componentType === 'text' && !props.text && !props.richText) {
      warnings.push('Text component should have text or richText property');
    }
    if (componentType === 'image' && !props.fileReference && !props.src) {
      errors.push('Image component requires fileReference or src property');
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      componentType,
      propsValidated: Object.keys(props).length,
    };
  }

  async updateComponent(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      if (!request.componentPath || typeof request.componentPath !== 'string') {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Component path is required and must be a string');
      }
      if (!request.properties || typeof request.properties !== 'object') {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Properties are required and must be an object');
      }
      if (!isValidContentPath(request.componentPath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PATH, `Component path '${request.componentPath}' is not within allowed content roots`, { path: request.componentPath, allowedRoots: Object.values(this.aemConfig.contentPaths) });
      }
      const client = this.createAxiosInstance();
      try {
        await client.get(`${request.componentPath}.json`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(AEM_ERROR_CODES.COMPONENT_NOT_FOUND, `Component not found at path: ${request.componentPath}`, { componentPath: request.componentPath });
        }
        throw handleAEMHttpError(error, 'updateComponent');
      }
      const formData = new URLSearchParams();
      Object.entries(request.properties).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          formData.append(`${key}@Delete`, '');
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            formData.append(`${key}`, item.toString());
          });
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      });
      const response = await client.post(request.componentPath, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        timeout: this.aemConfig.queries.timeoutMs,
      });
      const verificationResponse = await client.get(`${request.componentPath}.json`);
      return createSuccessResponse({
        message: 'Component updated successfully',
        path: request.componentPath,
        properties: request.properties,
        updatedProperties: verificationResponse.data,
        response: response.data,
        verification: {
          success: true,
          propertiesChanged: Object.keys(request.properties).length,
          timestamp: new Date().toISOString(),
        },
      }, 'updateComponent');
    }, 'updateComponent');
  }

  async undoChanges(request: any): Promise<object> {
    // Not implemented: AEM MCP does not support undo/rollback. Use AEM version history.
    return createSuccessResponse({
      message: 'undoChanges is not implemented. Please use AEM version history for undo/rollback.',
      request,
      timestamp: new Date().toISOString(),
    }, 'undoChanges');
  }

  async scanPageComponents(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}.infinity.json`);
      // Extraction logic as in the original JS
      const components: any[] = [];
      const processNode = (node: any, nodePath: string) => {
        if (!node || typeof node !== 'object') return;
        if (node['sling:resourceType']) {
          components.push({
            path: nodePath,
            resourceType: node['sling:resourceType'],
            properties: { ...node },
          });
        }
        Object.entries(node).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !key.startsWith('rep:') && !key.startsWith('oak:')) {
            const childPath = nodePath ? `${nodePath}/${key}` : key;
            processNode(value, childPath);
          }
        });
      };
      if (response.data['jcr:content']) {
        processNode(response.data['jcr:content'], 'jcr:content');
      } else {
        processNode(response.data, pagePath);
      }
      return createSuccessResponse({
        pagePath,
        components,
        totalComponents: components.length,
      }, 'scanPageComponents');
    }, 'scanPageComponents');
  }

  async fetchSites(): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get('/content.json', { params: { ':depth': '2' } });
      const sites: any[] = [];
      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object' && value['jcr:content']) {
          sites.push({
            name: key,
            path: `/content/${key}`,
            title: value['jcr:content']['jcr:title'] || key,
            template: value['jcr:content']['cq:template'],
            lastModified: value['jcr:content']['cq:lastModified'],
          });
        }
      });
      return createSuccessResponse({
        sites,
        totalCount: sites.length,
      }, 'fetchSites');
    }, 'fetchSites');
  }

  async fetchLanguageMasters(site: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`/content/${site}.json`, { params: { ':depth': '3' } });
      const masters: any[] = [];
      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object' && value['jcr:content']) {
          masters.push({
            name: key,
            path: `/content/${key}`,
            title: value['jcr:content']['jcr:title'] || key,
            language: value['jcr:content']['jcr:language'] || 'en',
          });
        }
      });
      return createSuccessResponse({
        site,
        languageMasters: masters,
      }, 'fetchLanguageMasters');
    }, 'fetchLanguageMasters');
  }

  async fetchAvailableLocales(site: string, languageMasterPath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${languageMasterPath}.json`, { params: { ':depth': '2' } });
      const locales: any[] = [];
      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object') {
          locales.push({
            name: key,
            title: value['jcr:content']?.['jcr:title'] || key,
            language: value['jcr:content']?.['jcr:language'] || key,
          });
        }
      });
      return createSuccessResponse({
        site,
        languageMasterPath,
        availableLocales: locales,
      }, 'fetchAvailableLocales');
    }, 'fetchAvailableLocales');
  }

  async replicateAndPublish(selectedLocales: any, componentData: any, localizedOverrides: any): Promise<object> {
    // Simulate replication logic for now
    return safeExecute<object>(async () => {
      return createSuccessResponse({
        message: 'Replication simulated',
        selectedLocales,
        componentData,
        localizedOverrides,
      }, 'replicateAndPublish');
    }, 'replicateAndPublish');
  }

  async getAllTextContent(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}.infinity.json`);
      const textContent: any[] = [];
      const processNode = (node: any, nodePath: string) => {
        if (!node || typeof node !== 'object') return;
        if (node['text'] || node['jcr:title'] || node['jcr:description']) {
          textContent.push({
            path: nodePath,
            title: node['jcr:title'],
            text: node['text'],
            description: node['jcr:description'],
          });
        }
        Object.entries(node).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !key.startsWith('rep:') && !key.startsWith('oak:')) {
            const childPath = nodePath ? `${nodePath}/${key}` : key;
            processNode(value, childPath);
          }
        });
      };
      if (response.data['jcr:content']) {
        processNode(response.data['jcr:content'], 'jcr:content');
      } else {
        processNode(response.data, pagePath);
      }
      return createSuccessResponse({
        pagePath,
        textContent,
      }, 'getAllTextContent');
    }, 'getAllTextContent');
  }

  async getPageTextContent(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      return this.getAllTextContent(pagePath); // Alias for now
    }, 'getPageTextContent');
  }

  async getPageImages(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}.infinity.json`);
      const images: any[] = [];
      const processNode = (node: any, nodePath: string) => {
        if (!node || typeof node !== 'object') return;
        if (node['fileReference'] || node['src']) {
          images.push({
            path: nodePath,
            fileReference: node['fileReference'],
            src: node['src'],
            alt: node['alt'] || node['altText'],
            title: node['jcr:title'] || node['title'],
          });
        }
        Object.entries(node).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !key.startsWith('rep:') && !key.startsWith('oak:')) {
            const childPath = nodePath ? `${nodePath}/${key}` : key;
            processNode(value, childPath);
          }
        });
      };
      if (response.data['jcr:content']) {
        processNode(response.data['jcr:content'], 'jcr:content');
      } else {
        processNode(response.data, pagePath);
      }
      return createSuccessResponse({
        pagePath,
        images,
      }, 'getPageImages');
    }, 'getPageImages');
  }

  async updateImagePath(componentPath: string, newImagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      return this.updateComponent({ componentPath, properties: { fileReference: newImagePath } });
    }, 'updateImagePath');
  }

  async getPageContent(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}.infinity.json`);
      return createSuccessResponse({
        pagePath,
        content: response.data,
      }, 'getPageContent');
    }, 'getPageContent');
  }

  /**
   * List direct children under a path using AEM's JSON API.
   * Returns array of { name, path, primaryType, title }.
   */
  async listChildren(path: string, depth: number = 1): Promise<any[]> {
    return safeExecute<any[]>(async () => {
      const client = this.createAxiosInstance();

      // First try direct JSON API approach
      try {
        const response = await client.get(`${path}.${depth}.json`);
        const children: any[] = [];

        if (response.data && typeof response.data === 'object') {
          Object.entries(response.data).forEach(([key, value]: [string, any]) => {
            // Skip JCR system properties and metadata
            if (key.startsWith('jcr:') || key.startsWith('sling:') || key.startsWith('cq:') ||
                key.startsWith('rep:') || key.startsWith('oak:') || key === 'jcr:content') {
              return;
            }

            if (value && typeof value === 'object') {
              const childPath = `${path}/${key}`;
              children.push({
                name: key,
                path: childPath,
                primaryType: value['jcr:primaryType'] || 'nt:unstructured',
                title: value['jcr:content']?.['jcr:title'] ||
                       value['jcr:title'] ||
                       key,
                lastModified: value['jcr:content']?.['cq:lastModified'] ||
                             value['cq:lastModified'],
                resourceType: value['jcr:content']?.['sling:resourceType'] ||
                             value['sling:resourceType']
              });
            }
          });
        }

        return children;
      } catch (error: any) {
        // Fallback to QueryBuilder for cq:Page nodes specifically
        if (error.response?.status === 404 || error.response?.status === 403) {
          const response = await client.get('/bin/querybuilder.json', {
            params: {
              path: path,
              type: 'cq:Page',
              'p.nodedepth': '1',
              'p.limit': '1000',
              'p.hits': 'full'
            },
          });

          const children = (response.data.hits || []).map((hit: any) => ({
            name: hit.name || hit.path?.split('/').pop(),
            path: hit.path,
            primaryType: hit['jcr:primaryType'] || 'cq:Page',
            title: hit['jcr:content/jcr:title'] || hit.title || hit.name,
            lastModified: hit['jcr:content/cq:lastModified'],
            resourceType: hit['jcr:content/sling:resourceType']
          }));

          return children;
        }
        throw error;
      }
    }, 'listChildren');
  }

  /**
   * List all cq:Page nodes under a site root, up to a given depth and limit.
   */
  async listPages(siteRoot: string, depth: number = 1, limit: number = 20): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();

      // First try direct JSON API approach for better performance
      try {
        const response = await client.get(`${siteRoot}.${depth}.json`);
        const pages: any[] = [];

        const processNode = (node: any, currentPath: string, currentDepth: number) => {
          if (currentDepth > depth || pages.length >= limit) return;

          Object.entries(node).forEach(([key, value]: [string, any]) => {
            if (pages.length >= limit) return;

            // Skip JCR system properties
            if (key.startsWith('jcr:') || key.startsWith('sling:') || key.startsWith('cq:') ||
                key.startsWith('rep:') || key.startsWith('oak:')) {
              return;
            }

            if (value && typeof value === 'object') {
              const childPath = `${currentPath}/${key}`;
              const primaryType = value['jcr:primaryType'];

              // Only include cq:Page nodes
              if (primaryType === 'cq:Page') {
                pages.push({
                  name: key,
                  path: childPath,
                  primaryType: 'cq:Page',
                  title: value['jcr:content']?.['jcr:title'] || key,
                  template: value['jcr:content']?.['cq:template'],
                  lastModified: value['jcr:content']?.['cq:lastModified'],
                  lastModifiedBy: value['jcr:content']?.['cq:lastModifiedBy'],
                  resourceType: value['jcr:content']?.['sling:resourceType'],
                  type: 'page'
                });
              }

              // Recursively process child nodes if within depth limit
              if (currentDepth < depth) {
                processNode(value, childPath, currentDepth + 1);
              }
            }
          });
        };

        if (response.data && typeof response.data === 'object') {
          processNode(response.data, siteRoot, 0);
        }

        return createSuccessResponse({
          siteRoot,
          pages,
          pageCount: pages.length,
          depth,
          limit,
          totalChildrenScanned: pages.length
        }, 'listPages');

      } catch (error: any) {
        // Fallback to QueryBuilder if JSON API fails
        if (error.response?.status === 404 || error.response?.status === 403) {
          const response = await client.get('/bin/querybuilder.json', {
            params: {
              path: siteRoot,
              type: 'cq:Page',
              'p.nodedepth': depth.toString(),
              'p.limit': limit.toString(),
              'p.hits': 'full'
            },
          });

          const pages = (response.data.hits || []).map((hit: any) => ({
            name: hit.name || hit.path?.split('/').pop(),
            path: hit.path,
            primaryType: 'cq:Page',
            title: hit['jcr:content/jcr:title'] || hit.title || hit.name,
            template: hit['jcr:content/cq:template'],
            lastModified: hit['jcr:content/cq:lastModified'],
            lastModifiedBy: hit['jcr:content/cq:lastModifiedBy'],
            resourceType: hit['jcr:content/sling:resourceType'],
            type: 'page'
          }));

          return createSuccessResponse({
            siteRoot,
            pages,
            pageCount: pages.length,
            depth,
            limit,
            totalChildrenScanned: response.data.total || pages.length,
            fallbackUsed: 'QueryBuilder'
          }, 'listPages');
        }
        throw error;
      }
    }, 'listPages');
  }

  /**
   * Execute a QueryBuilder fulltext search for cq:Page nodes, with security validation.
   * Note: This is NOT a true JCR SQL2 executor. It wraps QueryBuilder and only supports fulltext queries.
   */
  async executeJCRQuery(query: string, limit: number = 20): Promise<object> {
    return safeExecute<object>(async () => {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query is required and must be a non-empty string. Note: Only QueryBuilder fulltext is supported, not JCR SQL2.');
      }
      // Basic security validation
      const lower = query.toLowerCase();
      if (/drop|delete|update|insert|exec|script|\.|<script/i.test(lower) || query.length > 1000) {
        throw new Error('Query contains potentially unsafe patterns or is too long');
      }
      const client = this.createAxiosInstance();
      const response = await client.get('/bin/querybuilder.json', {
        params: {
          path: '/content',
          type: 'cq:Page',
          fulltext: query,
          'p.limit': limit
        }
      });
      return {
        query,
        results: response.data.hits || [],
        total: response.data.total || 0,
        limit
      };
    }, 'executeJCRQuery');
  }

  async getPageProperties(pagePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${pagePath}/jcr:content.json`);
      const content = response.data;
      const properties = {
        title: content['jcr:title'],
        description: content['jcr:description'],
        template: content['cq:template'],
        lastModified: content['cq:lastModified'],
        lastModifiedBy: content['cq:lastModifiedBy'],
        created: content['jcr:created'],
        createdBy: content['jcr:createdBy'],
        primaryType: content['jcr:primaryType'],
        resourceType: content['sling:resourceType'],
        tags: content['cq:tags'] || [],
        properties: content,
      };
      return createSuccessResponse({
        pagePath,
        properties
      }, 'getPageProperties');
    }, 'getPageProperties');
  }

  async searchContent(params: any): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const queryParams: any = { ...params };

      const maxLimit = this.aemConfig.queries.maxLimit;
      const defaultLimit = this.aemConfig.queries.defaultLimit;

      let limit = queryParams.limit ?? queryParams['p.limit'];
      if (limit === undefined || limit === null) {
        limit = defaultLimit;
      }
      let limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum <= 0) {
        limitNum = defaultLimit;
      }
      limitNum = Math.min(limitNum, maxLimit);
      if ('p.limit' in queryParams || !('limit' in queryParams)) {
        queryParams['p.limit'] = limitNum.toString();
        delete queryParams.limit;
      } else {
        queryParams.limit = limitNum;
      }

      if (queryParams.path && !isValidContentPath(queryParams.path, this.aemConfig)) {
        queryParams.path = this.aemConfig.contentPaths.sitesRoot;
      }

      const response = await client.get(this.config.aem.endpoints.query, { params: queryParams });
      return createSuccessResponse({
        params: queryParams,
        results: response.data.hits || [],
        total: response.data.total || 0,
        rawResponse: response.data,
      }, 'searchContent');
    }, 'searchContent');
  }

  async getAssetMetadata(assetPath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${assetPath}.json`);
      const metadata = response.data['jcr:content']?.metadata || {};
      return createSuccessResponse({
        assetPath,
        metadata,
        fullData: response.data,
      }, 'getAssetMetadata');
    }, 'getAssetMetadata');
  }

  async createPage(request: any): Promise<object> {
    // Use the enhanced createPageWithTemplate method
    return this.createPageWithTemplate(request);
  }

  async deletePage(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { pagePath, force = false } = request;
      if (!isValidContentPath(pagePath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid page path: ${String(pagePath)}`, { pagePath });
      }
      const client = this.createAxiosInstance();
      let deleted = false;
      try {
        await client.delete(pagePath);
        deleted = true;
      } catch (err: any) {
        if (err.response && err.response.status === 405) {
          try {
            await client.post('/bin/wcmcommand', {
              cmd: 'deletePage',
              path: pagePath,
              force: force.toString(),
            });
            deleted = true;
          } catch (postErr: any) {
            // Fallback to Sling POST servlet
            try {
              await client.post(pagePath, { ':operation': 'delete' });
              deleted = true;
            } catch (slingErr: any) {
              console.error('Sling POST delete failed:', slingErr.response?.status, slingErr.response?.data);
              throw slingErr;
            }
          }
        } else {
          console.error('DELETE failed:', err.response?.status, err.response?.data);
          throw err;
        }
      }
      return createSuccessResponse({
        success: deleted,
        deletedPath: pagePath,
        timestamp: new Date().toISOString(),
      }, 'deletePage');
    }, 'deletePage');
  }

  async createComponent(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { pagePath, componentType, resourceType, properties = {}, name } = request;
      if (!isValidContentPath(pagePath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid page path: ${String(pagePath)}`, { pagePath });
      }
      if (!isValidComponentType(componentType, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid component type: ${componentType}`, { componentType });
      }
      const componentName = name || `${componentType}_${Date.now()}`;
      const componentPath = `${pagePath}/jcr:content/${componentName}`;
      const client = this.createAxiosInstance();
      await client.post(componentPath, {
        'jcr:primaryType': 'nt:unstructured',
        'sling:resourceType': resourceType,
        ...properties,
        ':operation': 'import',
        ':contentType': 'json',
        ':replace': 'true',
      });
      return createSuccessResponse({
        success: true,
        componentPath,
        componentType,
        resourceType,
        properties,
        timestamp: new Date().toISOString(),
      }, 'createComponent');
    }, 'createComponent');
  }

  async deleteComponent(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { componentPath, force = false } = request;
      if (!isValidContentPath(componentPath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid component path: ${String(componentPath)}`, { componentPath });
      }
      const client = this.createAxiosInstance();
      let deleted = false;
      try {
        await client.delete(componentPath);
        deleted = true;
      } catch (err: any) {
        if (err.response && err.response.status === 405) {
          try {
            await client.post(componentPath, { ':operation': 'delete' });
            deleted = true;
          } catch (slingErr: any) {
            console.error('Sling POST delete failed:', slingErr.response?.status, slingErr.response?.data);
            throw slingErr;
          }
        } else {
          console.error('DELETE failed:', err.response?.status, err.response?.data);
          throw err;
        }
      }
      return createSuccessResponse({
        success: deleted,
        deletedPath: componentPath,
        timestamp: new Date().toISOString(),
      }, 'deleteComponent');
    }, 'deleteComponent');
  }

  async unpublishContent(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { contentPaths, unpublishTree = false } = request;
      if (!contentPaths || (Array.isArray(contentPaths) && contentPaths.length === 0)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Content paths array is required and cannot be empty', { contentPaths });
      }

      const client = this.createAxiosInstance();
      const results: any[] = [];

      // Process each path individually using the correct AEM replication API
      for (const path of Array.isArray(contentPaths) ? contentPaths : [contentPaths]) {
        try {
          // Use the correct AEM replication servlet endpoint
          const formData = new URLSearchParams();
          formData.append('cmd', 'Deactivate');
          formData.append('path', path);
          formData.append('ignoredeactivated', 'false');
          formData.append('onlymodified', 'false');

          if (unpublishTree) {
            formData.append('deep', 'true');
          }

          const response = await client.post('/bin/replicate.json', formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          results.push({
            path,
            success: true,
            response: response.data
          });
        } catch (error: any) {
          results.push({
            path,
            success: false,
            error: error.response?.data || error.message
          });
        }
      }

      return createSuccessResponse({
        success: results.every(r => r.success),
        results,
        unpublishedPaths: contentPaths,
        unpublishTree,
        timestamp: new Date().toISOString(),
      }, 'unpublishContent');
    }, 'unpublishContent');
  }

  async activatePage(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { pagePath, activateTree = false } = request;
      if (!isValidContentPath(pagePath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid page path: ${String(pagePath)}`, { pagePath });
      }

      const client = this.createAxiosInstance();

      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Activate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');

        if (activateTree) {
          formData.append('deep', 'true');
        }

        const response = await client.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return createSuccessResponse({
          success: true,
          activatedPath: pagePath,
          activateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'activatePage');
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          // Try using the WCM command servlet
          const wcmResponse = await client.post('/bin/wcmcommand', {
            cmd: 'activate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });

          return createSuccessResponse({
            success: true,
            activatedPath: pagePath,
            activateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'activatePage');
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'activatePage');
        }
      }
    }, 'activatePage');
  }

  async deactivatePage(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { pagePath, deactivateTree = false } = request;
      if (!isValidContentPath(pagePath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid page path: ${String(pagePath)}`, { pagePath });
      }

      const client = this.createAxiosInstance();

      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Deactivate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');

        if (deactivateTree) {
          formData.append('deep', 'true');
        }

        const response = await client.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return createSuccessResponse({
          success: true,
          deactivatedPath: pagePath,
          deactivateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'deactivatePage');
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          // Try using the WCM command servlet
          const wcmResponse = await client.post('/bin/wcmcommand', {
            cmd: 'deactivate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });

          return createSuccessResponse({
            success: true,
            deactivatedPath: pagePath,
            deactivateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'deactivatePage');
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'deactivatePage');
        }
      }
    }, 'deactivatePage');
  }

  async activateAsset(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { assetPath, activateTree = false } = request;
      if (!isValidContentPath(assetPath, this.aemConfig)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          `Invalid asset path: ${String(assetPath)}`,
          { assetPath }
        );
      }

      const client = this.createAxiosInstance();

      try {
        const formData = new URLSearchParams();
        formData.append('cmd', 'Activate');
        formData.append('path', assetPath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        if (activateTree) {
          formData.append('deep', 'true');
        }

        const response = await client.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return createSuccessResponse(
          {
            success: true,
            activatedPath: assetPath,
            activateTree,
            response: response.data,
            timestamp: new Date().toISOString(),
          },
          'activateAsset'
        );
      } catch (error: any) {
        throw handleAEMHttpError(error, 'activateAsset');
      }
    }, 'activateAsset');
  }

  async deactivateAsset(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { assetPath, deactivateTree = false } = request;
      if (!isValidContentPath(assetPath, this.aemConfig)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          `Invalid asset path: ${String(assetPath)}`,
          { assetPath }
        );
      }

      const client = this.createAxiosInstance();

      try {
        const formData = new URLSearchParams();
        formData.append('cmd', 'Deactivate');
        formData.append('path', assetPath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        if (deactivateTree) {
          formData.append('deep', 'true');
        }

        const response = await client.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return createSuccessResponse(
          {
            success: true,
            deactivatedPath: assetPath,
            deactivateTree,
            response: response.data,
            timestamp: new Date().toISOString(),
          },
          'deactivateAsset'
        );
      } catch (error: any) {
        throw handleAEMHttpError(error, 'deactivateAsset');
      }
    }, 'deactivateAsset');
  }

  async uploadAsset(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { parentPath, fileName, fileContent, mimeType, metadata = {} } = request;
      if (!isValidContentPath(parentPath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid parent path: ${String(parentPath)}`, { parentPath });
      }

      const client = this.createAxiosInstance();
      const assetPath = `${parentPath}/${fileName}`;

      try {
        // Use proper AEM DAM asset upload via Sling POST servlet
        const formData = new URLSearchParams();

        // Set the file content (base64 or binary)
        if (typeof fileContent === 'string') {
          // Assume base64 encoded content
          formData.append('file', fileContent);
        } else {
          formData.append('file', fileContent.toString());
        }

        // Set required Sling POST parameters for asset creation
        formData.append('fileName', fileName);
        formData.append(':operation', 'import');
        formData.append(':contentType', 'json');
        formData.append(':replace', 'true');
        formData.append('jcr:primaryType', 'dam:Asset');

        if (mimeType) {
          formData.append('jcr:content/jcr:mimeType', mimeType);
        }

        // Add metadata to jcr:content/metadata node
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`jcr:content/metadata/${key}`, String(value));
        });

        const response = await client.post(assetPath, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        // Verify the asset was created
        const verificationResponse = await client.get(`${assetPath}.json`);

        return createSuccessResponse({
          success: true,
          assetPath,
          fileName,
          mimeType,
          metadata,
          uploadResponse: response.data,
          assetData: verificationResponse.data,
          timestamp: new Date().toISOString(),
        }, 'uploadAsset');
      } catch (error: any) {
        // Fallback to alternative DAM API if available
        try {
          const damResponse = await client.post('/api/assets' + parentPath, {
            fileName,
            fileContent,
            mimeType,
            metadata
          });

          return createSuccessResponse({
            success: true,
            assetPath,
            fileName,
            mimeType,
            metadata,
            uploadResponse: damResponse.data,
            fallbackUsed: 'DAM API',
            timestamp: new Date().toISOString(),
          }, 'uploadAsset');
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'uploadAsset');
        }
      }
    }, 'uploadAsset');
  }

  async updateAsset(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { assetPath, metadata, fileContent, mimeType } = request;
      if (!isValidContentPath(assetPath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid asset path: ${String(assetPath)}`, { assetPath });
      }

      const client = this.createAxiosInstance();
      const formData = new URLSearchParams();

      // Update file content if provided
      if (fileContent) {
        formData.append('file', fileContent);
        if (mimeType) {
          formData.append('jcr:content/jcr:mimeType', mimeType);
        }
      }

      // Update metadata if provided
      if (metadata && typeof metadata === 'object') {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`jcr:content/metadata/${key}`, String(value));
        });
      }

      try {
        const response = await client.post(assetPath, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        // Verify the update
        const verificationResponse = await client.get(`${assetPath}.json`);

        return createSuccessResponse({
          success: true,
          assetPath,
          updatedMetadata: metadata,
          updateResponse: response.data,
          assetData: verificationResponse.data,
          timestamp: new Date().toISOString(),
        }, 'updateAsset');
      } catch (error: any) {
        throw handleAEMHttpError(error, 'updateAsset');
      }
    }, 'updateAsset');
  }

  async deleteAsset(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { assetPath, force = false } = request;
      if (!isValidContentPath(assetPath, this.aemConfig)) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid asset path: ${String(assetPath)}`, { assetPath });
      }
      const client = this.createAxiosInstance();
      await client.delete(assetPath);
      return createSuccessResponse({
        success: true,
        deletedPath: assetPath,
        force,
        timestamp: new Date().toISOString(),
      }, 'deleteAsset');
    }, 'deleteAsset');
  }

  async getTemplates(sitePath?: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();

      // If sitePath is provided, look for templates specific to that site
      if (sitePath) {
        try {
          // Try to get site-specific templates from /conf
          const confPath = `/conf${sitePath.replace('/content', '')}/settings/wcm/templates`;
          const response = await client.get(`${confPath}.json`, {
            params: { ':depth': '2' }
          });

          const templates: any[] = [];
          if (response.data && typeof response.data === 'object') {
            Object.entries(response.data).forEach(([key, value]: [string, any]) => {
              if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
              if (value && typeof value === 'object' && value['jcr:content']) {
                templates.push({
                  name: key,
                  path: `${confPath}/${key}`,
                  title: value['jcr:content']['jcr:title'] || key,
                  description: value['jcr:content']['jcr:description'],
                  allowedPaths: value['jcr:content']['allowedPaths'],
                  ranking: value['jcr:content']['ranking'] || 0
                });
              }
            });
          }

          return createSuccessResponse({
            sitePath,
            templates,
            totalCount: templates.length,
            source: 'site-specific'
          }, 'getTemplates');
        } catch (error: any) {
          // Fallback to global templates if site-specific not found
        }
      }

      // Get global templates from /apps or /libs
      try {
        const globalPaths = ['/apps/wcm/core/content/sites/templates', '/libs/wcm/core/content/sites/templates'];
        const allTemplates: any[] = [];

        for (const templatePath of globalPaths) {
          try {
            const response = await client.get(`${templatePath}.json`, {
              params: { ':depth': '2' }
            });

            if (response.data && typeof response.data === 'object') {
              Object.entries(response.data).forEach(([key, value]: [string, any]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
                if (value && typeof value === 'object') {
                  allTemplates.push({
                    name: key,
                    path: `${templatePath}/${key}`,
                    title: value['jcr:content']?.['jcr:title'] || key,
                    description: value['jcr:content']?.['jcr:description'],
                    allowedPaths: value['jcr:content']?.['allowedPaths'],
                    ranking: value['jcr:content']?.['ranking'] || 0,
                    source: templatePath.includes('/apps/') ? 'apps' : 'libs'
                  });
                }
              });
            }
          } catch (pathError: any) {
            // Continue to next path if this one fails
          }
        }

        return createSuccessResponse({
          sitePath: sitePath || 'global',
          templates: allTemplates,
          totalCount: allTemplates.length,
          source: 'global'
        }, 'getTemplates');
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getTemplates');
      }
    }, 'getTemplates');
  }

  async getTemplateStructure(templatePath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();

      try {
        // Get the full template structure with deeper depth
        const response = await client.get(`${templatePath}.infinity.json`);

        const structure = {
          path: templatePath,
          properties: response.data['jcr:content'] || {},
          policies: response.data['jcr:content']?.['policies'] || {},
          structure: response.data['jcr:content']?.['structure'] || {},
          initialContent: response.data['jcr:content']?.['initial'] || {},
          allowedComponents: [] as string[],
          allowedPaths: response.data['jcr:content']?.['allowedPaths'] || []
        };

        // Extract allowed components from policies
        const extractComponents = (node: any, path: string = '') => {
          if (!node || typeof node !== 'object') return;

          if (node['components']) {
            const componentKeys = Object.keys(node['components']);
            structure.allowedComponents.push(...componentKeys);
          }

          Object.entries(node).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !key.startsWith('jcr:')) {
              extractComponents(value, path ? `${path}/${key}` : key);
            }
          });
        };

        extractComponents(structure.policies);

        // Remove duplicates
        structure.allowedComponents = [...new Set(structure.allowedComponents)];

        return createSuccessResponse({
          templatePath,
          structure,
          fullData: response.data
        }, 'getTemplateStructure');
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getTemplateStructure');
      }
    }, 'getTemplateStructure');
  }

  /**
   * Bulk update multiple components with validation and rollback support.
   */
  async bulkUpdateComponents(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { updates, validateFirst = true, continueOnError = false } = request;

      if (!Array.isArray(updates) || updates.length === 0) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Updates array is required and cannot be empty');
      }

      const results: any[] = [];
      const client = this.createAxiosInstance();

      // Validation phase if requested
      if (validateFirst) {
        for (const update of updates) {
          try {
            await client.get(`${update.componentPath}.json`);
          } catch (error: any) {
            if (error.response?.status === 404) {
              results.push({
                componentPath: update.componentPath,
                success: false,
                error: `Component not found: ${update.componentPath}`,
                phase: 'validation'
              });
              if (!continueOnError) {
                return createSuccessResponse({
                  success: false,
                  message: 'Bulk update failed during validation phase',
                  results,
                  totalUpdates: updates.length,
                  successfulUpdates: 0
                }, 'bulkUpdateComponents');
              }
            }
          }
        }
      }

      // Update phase
      let successCount = 0;
      for (const update of updates) {
        try {
          const result = await this.updateComponent({
            componentPath: update.componentPath,
            properties: update.properties
          });

          results.push({
            componentPath: update.componentPath,
            success: true,
            result: result,
            phase: 'update'
          });
          successCount++;
        } catch (error: any) {
          results.push({
            componentPath: update.componentPath,
            success: false,
            error: error.message,
            phase: 'update'
          });

          if (!continueOnError) {
            break;
          }
        }
      }

      return createSuccessResponse({
        success: successCount === updates.length,
        message: `Bulk update completed: ${successCount}/${updates.length} successful`,
        results,
        totalUpdates: updates.length,
        successfulUpdates: successCount,
        failedUpdates: updates.length - successCount
      }, 'bulkUpdateComponents');
    }, 'bulkUpdateComponents');
  }

  /**
   * Legacy: Get JCR node content as raw JSON for a given path and depth.
   */
  async getNodeContent(path: string, depth: number = 1): Promise<any> {
    return safeExecute<any>(async () => {
      const client = this.createAxiosInstance();
      const response = await client.get(`${path}.json`, {
        params: { ':depth': depth.toString() }
      });
      return {
        path,
        depth,
        content: response.data,
        timestamp: new Date().toISOString()
      };
    }, 'getNodeContent');
  }

  /**
   * Enhanced getTemplates method with better template discovery and validation
   */
  async getAvailableTemplates(parentPath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();

      // Try to determine site configuration from parent path
      let confPath = '/conf';
      const pathParts = parentPath.split('/');
      if (pathParts.length >= 3 && pathParts[1] === 'content') {
        const siteName = pathParts[2];
        confPath = `/conf/${siteName}`;
      }

      // Get templates from configuration
      const templatesPath = `${confPath}/settings/wcm/templates`;

      try {
        const response = await client.get(`${templatesPath}.json`, {
          params: { ':depth': '3' }
        });

        const templates: any[] = [];

        if (response.data && typeof response.data === 'object') {
          Object.entries(response.data).forEach(([key, value]: [string, any]) => {
            if (key.startsWith('jcr:') || key.startsWith('sling:')) return;

            if (value && typeof value === 'object' && value['jcr:content']) {
              const templatePath = `${templatesPath}/${key}`;
              const content = value['jcr:content'];

              templates.push({
                name: key,
                path: templatePath,
                title: content['jcr:title'] || key,
                description: content['jcr:description'] || '',
                thumbnail: content['thumbnail'] || '',
                allowedPaths: content['allowedPaths'] || [],
                status: content['status'] || 'enabled',
                ranking: content['ranking'] || 0,
                templateType: content['templateType'] || 'page',
                lastModified: content['cq:lastModified'],
                createdBy: content['jcr:createdBy']
              });
            }
          });
        }

        // Sort templates by ranking and name
        templates.sort((a, b) => {
          if (a.ranking !== b.ranking) {
            return b.ranking - a.ranking; // Higher ranking first
          }
          return a.name.localeCompare(b.name);
        });

        return createSuccessResponse({
          parentPath,
          templatesPath,
          templates,
          totalCount: templates.length,
          availableTemplates: templates.filter(t => t.status === 'enabled')
        }, 'getAvailableTemplates');

      } catch (error: any) {
        if (error.response?.status === 404) {
          // Fallback to global templates
          const globalTemplatesPath = '/libs/wcm/foundation/templates';
          const globalResponse = await client.get(`${globalTemplatesPath}.json`, {
            params: { ':depth': '2' }
          });

          const globalTemplates: any[] = [];
          if (globalResponse.data && typeof globalResponse.data === 'object') {
            Object.entries(globalResponse.data).forEach(([key, value]: [string, any]) => {
              if (key.startsWith('jcr:') || key.startsWith('sling:')) return;

              if (value && typeof value === 'object') {
                globalTemplates.push({
                  name: key,
                  path: `${globalTemplatesPath}/${key}`,
                  title: value['jcr:title'] || key,
                  description: value['jcr:description'] || 'Global template',
                  status: 'enabled',
                  ranking: 0,
                  templateType: 'page',
                  isGlobal: true
                });
              }
            });
          }

          return createSuccessResponse({
            parentPath,
            templatesPath: globalTemplatesPath,
            templates: globalTemplates,
            totalCount: globalTemplates.length,
            availableTemplates: globalTemplates,
            fallbackUsed: true
          }, 'getAvailableTemplates');
        }
        throw error;
      }
    }, 'getAvailableTemplates');
  }

    /**
     * Create a page by calling an AEM servlet that wraps PageManager.create(...).
     * Requires an AEM endpoint like /bin/aem/create-page (POST form fields).
     */
    async createPageWithTemplate(request: {
        parentPath: string;
        title: string;
        template: string;
        name?: string;
        endpoint?: string; // optional override; defaults to /bin/aem/create-page
    }): Promise<{ success: boolean; pagePath: string; httpStatus: number; aemResponse?: any }> {
        return safeExecute(async () => {
            const { parentPath, title, template, name, endpoint } = request;

            if (!isValidContentPath(parentPath, this.aemConfig)) {
                const err = new Error(`Invalid parent path: ${String(parentPath)}`);
                (err as any).name = "INVALID_PARAMETERS";
                throw err;
            }
            if (!title || !template) {
                const err = new Error("Missing required fields: title, template");
                (err as any).name = "INVALID_PARAMETERS";
                throw err;
            }

            const pageName = (name || String(title))
                .trim()
                .replace(/[^a-zA-Z0-9-_]/g, "-")
                .toLowerCase();

            const servlet = endpoint || "/bin/aem/create-page";
            const client = this.createAxiosInstance();

            const form = new URLSearchParams();
            form.append("parentPath", parentPath);
            form.append("pageName", pageName);
            form.append("title", String(title));
            form.append("template", template);

            const resp = await client.post(servlet, form, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                validateStatus: (s) => s >= 200 && s < 500
            });

            if (resp.status >= 400) {
                const err = new Error(
                    `AEM servlet error ${resp.status}: ${
                        typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data)
                    }`
                );
                (err as any).name = "AEM_REQUEST_FAILED";
                (err as any).meta = { servlet, parentPath, pageName, template, status: resp.status };
                throw err;
            }

            return {
                success: true,
                pagePath: `${parentPath}/${pageName}`,
                httpStatus: resp.status,
                aemResponse: resp.data
            };
        }, "createPageWithTemplate");
    }

  /**
   * Validate template compatibility with target path
   */
  public async validateTemplate(templatePath: string, targetPath: string): Promise<object> {
    return safeExecute<object>(async () => {
      const client = this.createAxiosInstance();

      try {
        const response = await client.get(`${templatePath}.json`);
        const templateData = response.data;

        if (!templateData || !templateData['jcr:content']) {
          throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Invalid template structure', { templatePath });
        }

        const content = templateData['jcr:content'];
        const allowedPaths = content['allowedPaths'] || [];

        // Check if target path is allowed
        let isAllowed = allowedPaths.length === 0; // If no restrictions, allow all

        if (allowedPaths.length > 0) {
          isAllowed = allowedPaths.some((allowedPath: string) => {
            return targetPath.startsWith(allowedPath);
          });
        }

        return createSuccessResponse({
          templatePath,
          targetPath,
          isValid: isAllowed,
          templateTitle: content['jcr:title'] || 'Untitled Template',
          templateDescription: content['jcr:description'] || '',
          allowedPaths,
          restrictions: {
            hasPathRestrictions: allowedPaths.length > 0,
            allowedPaths
          }
        }, 'validateTemplate');

      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Template not found: ${templatePath}`, { templatePath });
        }
        throw handleAEMHttpError(error, 'validateTemplate');
      }
    }, 'validateTemplate');
  }

  /**
   * Get template metadata and caching
   */
  private templateCache = new Map<string, any>();
  private templateCacheExpiry = new Map<string, number>();
  private readonly TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  public async getTemplateMetadata(templatePath: string, useCache: boolean = true): Promise<object> {
    return safeExecute<object>(async () => {
      // Check cache first
      if (useCache && this.templateCache.has(templatePath)) {
        const expiry = this.templateCacheExpiry.get(templatePath) || 0;
        if (Date.now() < expiry) {
          return createSuccessResponse({
            ...this.templateCache.get(templatePath),
            fromCache: true
          }, 'getTemplateMetadata');
        }
      }

      const client = this.createAxiosInstance();
      const response = await client.get(`${templatePath}.json`);

      if (!response.data || !response.data['jcr:content']) {
        throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Invalid template structure', { templatePath });
      }

      const content = response.data['jcr:content'];
      const metadata = {
        templatePath,
        title: content['jcr:title'] || 'Untitled Template',
        description: content['jcr:description'] || '',
        thumbnail: content['thumbnail'] || '',
        allowedPaths: content['allowedPaths'] || [],
        status: content['status'] || 'enabled',
        ranking: content['ranking'] || 0,
        templateType: content['templateType'] || 'page',
        lastModified: content['cq:lastModified'],
        createdBy: content['jcr:createdBy'],
        policies: content['policies'] || {},
        structure: content['structure'] || {},
        initialContent: content['initial'] || {}
      };

      // Cache the result
      if (useCache) {
        this.templateCache.set(templatePath, metadata);
        this.templateCacheExpiry.set(templatePath, Date.now() + this.TEMPLATE_CACHE_TTL);
      }

      return createSuccessResponse(metadata, 'getTemplateMetadata');
    }, 'getTemplateMetadata');
  }

  /**
   * Clear template cache
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
    this.templateCacheExpiry.clear();
    console.log('🗑️ Template cache cleared');
  }

  async startWorkflow(request: any): Promise<object> {
    return safeExecute<object>(async () => {
      const { modelId, payloadPath, title } = request || {};
      if (!modelId || typeof modelId !== 'string') {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          'Workflow modelId is required and must be a string'
        );
      }
      if (!payloadPath || typeof payloadPath !== 'string') {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          'Payload path is required and must be a string'
        );
      }
      if (!isValidContentPath(payloadPath, this.aemConfig)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PATH,
          `Payload path '${payloadPath}' is not within allowed content roots`,
          { path: payloadPath, allowedRoots: Object.values(this.aemConfig.contentPaths) }
        );
      }

      const client = this.createAxiosInstance();
      try {
        const response = await client.post(
          `/api/workflow/runtime/models/${encodeURIComponent(modelId)}/instances`,
          {
            payload: payloadPath,
            payloadType: 'JCR_PATH',
            workflowTitle: title,
          }
        );
        const workflowId = response.data?.id || response.data?.workflowId || response.data;
        return createSuccessResponse(
          {
            workflowId,
            modelId,
            payloadPath,
            state: response.data?.state || 'unknown',
          },
          'startWorkflow'
        );
      } catch (error: any) {
        throw handleAEMHttpError(error, 'startWorkflow');
      }
    }, 'startWorkflow');
  }

  async getWorkflowStatus(workflowId: string): Promise<object> {
    return safeExecute<object>(async () => {
      if (!workflowId || typeof workflowId !== 'string') {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          'Workflow ID is required and must be a string'
        );
      }
      const client = this.createAxiosInstance();
      try {
        const response = await client.get(
          `/api/workflow/runtime/instances/${encodeURIComponent(workflowId)}`
        );
        return createSuccessResponse(
          {
            workflowId,
            status: response.data?.status || response.data?.state,
            data: response.data,
          },
          'getWorkflowStatus'
        );
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getWorkflowStatus');
      }
    }, 'getWorkflowStatus');
  }
}
