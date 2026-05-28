#!/usr/bin/env node
process.env.CHECKOUT_E2E = '1';
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, ['--test', path.join(__dirname, '..', 'tests', 'checkout.e2e.test.js')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});

process.exit(result.status ?? 1);
