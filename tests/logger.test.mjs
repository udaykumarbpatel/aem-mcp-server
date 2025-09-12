import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '../dist/logger.js';

const bigMessage = 'x'.repeat(200);

function logFileBase(dir, type = 'aem-mcp') {
  const date = new Date().toISOString().split('T')[0];
  return join(dir, `${type}-${date}.log`);
}

test('rotates log files when maxFileSize exceeded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logger-test-'));
  const logger = new Logger({
    enableConsole: false,
    logDirectory: dir,
    maxFileSize: 100,
    maxFiles: 2,
    enableStructuredLogging: false,
  });

  logger.info(bigMessage);
  logger.info(bigMessage);
  logger.info(bigMessage);
  logger.info(bigMessage);

  const base = logFileBase(dir);
  assert.ok(existsSync(base));
  assert.ok(existsSync(`${base}.1`));
  assert.ok(existsSync(`${base}.2`));
  assert.ok(!existsSync(`${base}.3`));

  rmSync(dir, { recursive: true, force: true });
});

test('rotates error logs separately when maxFileSize exceeded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logger-error-test-'));
  const logger = new Logger({
    enableConsole: false,
    logDirectory: dir,
    maxFileSize: 100,
    maxFiles: 1,
    enableStructuredLogging: false,
  });

  logger.error(bigMessage);
  logger.error(bigMessage);

  const base = logFileBase(dir, 'aem-mcp-errors');
  assert.ok(existsSync(base));
  assert.ok(existsSync(`${base}.1`));
  assert.ok(!existsSync(`${base}.2`));

  rmSync(dir, { recursive: true, force: true });
});
