#!/usr/bin/env node

// Debug script to test MCP server functionality
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 MCP Server Debug Tool');
console.log('========================');

// Test 1: Check if MCP server can start
console.log('\n1. Testing MCP Server Startup...');
const mcpServerPath = join(__dirname, 'dist', 'mcp-server.js');
console.log(`MCP Server Path: ${mcpServerPath}`);

const mcpProcess = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let serverStarted = false;
let errorOutput = '';

mcpProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('Server stderr:', output);
  if (output.includes('AEM MCP Server running')) {
    serverStarted = true;
    console.log('✅ MCP Server started successfully');
    testMCPCommunication();
  }
  if (output.includes('error') || output.includes('Error')) {
    errorOutput += output;
  }
});

mcpProcess.stdout.on('data', (data) => {
  console.log('Server stdout:', data.toString());
});

mcpProcess.on('error', (error) => {
  console.error('❌ Failed to start MCP server:', error.message);
  process.exit(1);
});

// Test 2: Test MCP communication
function testMCPCommunication() {
  console.log('\n2. Testing MCP Communication...');
  
  // Test ListTools request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  };
  
  console.log('Sending ListTools request...');
  mcpProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Test CallTool request for listPages
  setTimeout(() => {
    const callToolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'listPages',
        arguments: {
          siteRoot: '/content',
          depth: 1,
          limit: 5
        }
      }
    };
    
    console.log('Sending CallTool request for listPages...');
    mcpProcess.stdin.write(JSON.stringify(callToolRequest) + '\n');
    
    // Clean up after tests
    setTimeout(() => {
      console.log('\n3. Test Results Summary:');
      if (serverStarted) {
        console.log('✅ MCP Server startup: SUCCESS');
      } else {
        console.log('❌ MCP Server startup: FAILED');
        if (errorOutput) {
          console.log('Error details:', errorOutput);
        }
      }
      
      mcpProcess.kill();
      process.exit(0);
    }, 3000);
  }, 1000);
}

// Timeout for the entire test
setTimeout(() => {
  if (!serverStarted) {
    console.log('❌ MCP Server failed to start within timeout');
    if (errorOutput) {
      console.log('Error output:', errorOutput);
    }
    mcpProcess.kill();
    process.exit(1);
  }
}, 10000);