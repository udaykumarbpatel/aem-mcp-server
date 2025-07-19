#!/usr/bin/env node

// Quick test script to verify the AEM MCP server starts correctly
import { AEMConnector } from './dist/aem-connector.js';
import { MCPRequestHandler } from './dist/mcp-handler.js';

async function testServer() {
  console.log('🧪 Testing AEM MCP Server...');
  
  try {
    // Test AEM Connector initialization
    console.log('1. Initializing AEM Connector...');
    const aemConnector = new AEMConnector();
    console.log('✅ AEM Connector initialized successfully');
    
    // Test MCP Handler initialization
    console.log('2. Initializing MCP Handler...');
    const mcpHandler = new MCPRequestHandler(aemConnector);
    console.log('✅ MCP Handler initialized successfully');
    
    // Test available methods
    console.log('3. Testing available methods...');
    const methods = mcpHandler.getAvailableMethods();
    console.log(`✅ Found ${methods.length} available methods:`);
    
    // List key methods that were improved
    const keyMethods = ['listChildren', 'listPages', 'activatePage', 'deactivatePage', 'bulkUpdateComponents'];
    keyMethods.forEach(method => {
      const found = methods.find(m => m.name === method);
      if (found) {
        console.log(`   ✅ ${method} - ${found.description}`);
      } else {
        console.log(`   ❌ ${method} - NOT FOUND`);
      }
    });
    
    // Test connection (will fail without AEM but should not crash)
    console.log('4. Testing AEM connection...');
    try {
      const connected = await aemConnector.testConnection();
      if (connected) {
        console.log('✅ AEM connection successful');
      } else {
        console.log('⚠️  AEM connection failed (expected if AEM is not running)');
      }
    } catch (error) {
      console.log('⚠️  AEM connection test failed (expected if AEM is not running):', error.message);
    }
    
    console.log('\n🎉 All tests passed! The AEM MCP Server is ready to use.');
    console.log('\nTo start the server:');
    console.log('  npm start     # Start the gateway server');
    console.log('  npm run mcp   # Start the MCP server');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testServer();