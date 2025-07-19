# AEM MCP Server Configuration Guide

## Overview
This guide explains how to configure and connect to the AEM MCP (Model Context Protocol) server for use with AI IDEs like Cursor, Cline, and other MCP-compatible clients.

## Server Architecture

The AEM MCP server runs in two modes:
1. **HTTP Gateway Server** (Port 3000) - REST API and web interface
2. **MCP Server** (stdio) - Standard MCP protocol for AI IDEs

## Quick Start

### 1. Environment Configuration

Create or update your `.env` file:

```env
# AEM Configuration
AEM_HOST=http://localhost:4502
AEM_SERVICE_USER=admin
AEM_SERVICE_PASSWORD=admin

# MCP Server Configuration
MCP_PORT=8080
GATEWAY_PORT=3000
MCP_USERNAME=admin
MCP_PASSWORD=admin
```

### 2. Start the Servers

```bash
# Build the project
npm run build

# Start HTTP Gateway Server (REST API)
npm start

# Start MCP Server (for AI IDEs) - in separate terminal
npm run mcp
```

## MCP Client Configuration

### For AI IDEs (Cursor, Cline, etc.)

Add this configuration to your MCP settings:

#### Option 1: Direct Node.js Execution
```json
{
  "mcpServers": {
    "aem-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/your/aem-mcp-server/dist/mcp-server.js"
      ],
      "env": {
        "AEM_HOST": "http://localhost:4502",
        "AEM_SERVICE_USER": "admin",
        "AEM_SERVICE_PASSWORD": "admin"
      }
    }
  }
}
```

#### Option 2: NPM Script Execution
```json
{
  "mcpServers": {
    "aem-mcp": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "C:/path/to/your/aem-mcp-server",
      "env": {
        "AEM_HOST": "http://localhost:4502",
        "AEM_SERVICE_USER": "admin",
        "AEM_SERVICE_PASSWORD": "admin"
      }
    }
  }
}
```

### For Custom MCP Clients

#### HTTP/JSON-RPC Endpoint
```
POST http://localhost:3000/mcp
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=  # admin:admin base64

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "listPages",
  "params": {
    "siteRoot": "/content",
    "depth": 2,
    "limit": 10
  }
}
```

## Available Methods

### Core AEM Operations
- `listPages` - List pages under a site root
- `listChildren` - List child nodes under a path
- `getPageContent` - Get complete page content
- `getPageProperties` - Get page metadata
- `scanPageComponents` - Discover all components on a page

### Component Management
- `validateComponent` - Validate component before updates
- `updateComponent` - Update component properties
- `bulkUpdateComponents` - Update multiple components
- `createComponent` - Create new components
- `deleteComponent` - Remove components

### Content Management
- `createPage` - Create new pages
- `deletePage` - Remove pages
- `activatePage` - Publish pages
- `deactivatePage` - Unpublish pages
- `unpublishContent` - Bulk unpublish content

### Asset Management
- `uploadAsset` - Upload new assets to DAM
- `updateAsset` - Update existing assets
- `deleteAsset` - Remove assets
- `getAssetMetadata` - Get asset information

### Search & Query
- `searchContent` - Search using QueryBuilder
- `executeJCRQuery` - Execute JCR queries
- `enhancedPageSearch` - Advanced page search

### Template & Structure
- `getTemplates` - List available templates
- `getTemplateStructure` - Get template details
- `fetchSites` - List all sites
- `fetchLanguageMasters` - Get language masters

## Configuration Examples

### Development Environment
```env
AEM_HOST=http://localhost:4502
AEM_SERVICE_USER=admin
AEM_SERVICE_PASSWORD=admin
MCP_PORT=8080
GATEWAY_PORT=3000
```

### Production Environment
```env
AEM_HOST=https://author.yourcompany.com
AEM_SERVICE_USER=mcp-service-user
AEM_SERVICE_PASSWORD=secure-password
MCP_PORT=8080
GATEWAY_PORT=3000
MCP_USERNAME=mcp-client
MCP_PASSWORD=secure-mcp-password
```

### Cloud Environment (AEM as a Cloud Service)
```env
AEM_HOST=https://author-p12345-e67890.adobeaemcloud.com
AEM_SERVICE_USER=technical-account-user
AEM_SERVICE_PASSWORD=jwt-token-or-service-credentials
MCP_PORT=8080
GATEWAY_PORT=3000
```

## Testing the Connection

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. List Available Methods
```bash
curl http://localhost:3000/mcp/methods
```

### 3. Test MCP Call
```bash
curl -u admin:admin -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "listPages",
    "params": {
      "siteRoot": "/content",
      "depth": 1,
      "limit": 5
    }
  }'
```

## IDE-Specific Configuration

### Cursor IDE
1. Open Cursor Settings
2. Go to Extensions → MCP
3. Add server configuration:
```json
{
  "aem-mcp": {
    "command": "node",
    "args": ["C:/path/to/aem-mcp-server/dist/mcp-server.js"]
  }
}
```

### Cline Extension
1. Open VS Code
2. Install Cline extension
3. Configure MCP servers in settings.json:
```json
{
  "cline.mcpServers": {
    "aem-mcp": {
      "command": "node",
      "args": ["C:/path/to/aem-mcp-server/dist/mcp-server.js"]
    }
  }
}
```

### Claude Desktop
Add to your Claude Desktop config file:
```json
{
  "mcpServers": {
    "aem-mcp": {
      "command": "node",
      "args": ["C:/path/to/aem-mcp-server/dist/mcp-server.js"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check AEM is running on specified host/port
   - Verify credentials are correct
   - Check network connectivity

2. **Authentication Errors**
   - Verify AEM_SERVICE_USER has proper permissions
   - Check password is correct
   - Ensure user is not locked

3. **MCP Server Not Starting**
   - Run `npm run build` first
   - Check Node.js version (requires 18+)
   - Verify all dependencies installed

4. **Methods Not Working**
   - Check AEM version compatibility (6.5+)
   - Verify user has required permissions
   - Check AEM logs for errors

### Debug Mode
Enable debug logging:
```env
DEBUG=aem-mcp:*
NODE_ENV=development
```

### Logs Location
- Server logs: Console output
- AEM logs: `<aem-install>/crx-quickstart/logs/`
- Error logs: Check both server and AEM logs

## Security Considerations

### Production Deployment
1. Use dedicated service user with minimal permissions
2. Enable HTTPS for all connections
3. Use strong passwords and rotate regularly
4. Restrict network access to MCP server
5. Monitor and log all operations

### Recommended AEM Permissions
Create a dedicated service user with:
- Read access to `/content`
- Write access to specific content paths
- Replication permissions for publish operations
- DAM access for asset operations

## Performance Tuning

### Server Configuration
```env
# Increase timeouts for large operations
AEM_QUERY_TIMEOUT=60000
AEM_QUERY_MAX_LIMIT=500

# Optimize connection pooling
AEM_MAX_CONNECTIONS=10
AEM_CONNECTION_TIMEOUT=30000
```

### AEM Configuration
- Enable JSON servlet for better performance
- Configure proper caching headers
- Optimize QueryBuilder settings
- Monitor JVM heap usage

## Support and Documentation

- **API Documentation**: http://localhost:3000/api-docs
- **Health Status**: http://localhost:3000/health
- **Method List**: http://localhost:3000/mcp/methods
- **OpenAPI Spec**: http://localhost:3000/openapi.json

For issues and support, check the server logs and AEM error logs for detailed error information.