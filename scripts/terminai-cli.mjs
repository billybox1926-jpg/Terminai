#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

const serve = () => {
  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
};

serve();
