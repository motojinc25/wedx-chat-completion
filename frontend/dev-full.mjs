#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env files if they exist
const frontendEnvPath = join(__dirname, '.env');
const backendEnvPath = join(__dirname, '..', 'backend', '.env');

// Disable dotenv debug messages
if (existsSync(frontendEnvPath)) {
  config({ path: frontendEnvPath, debug: false });
}

if (existsSync(backendEnvPath)) {
  config({ path: backendEnvPath, debug: false });
}

// Port configuration from environment variables
const FRONTEND_PORT = process.env.VITE_FRONTEND_PORT || '5173';
const BACKEND_PORT = process.env.BACKEND_PORT || '8000';

let backendProcess = null;
let frontendProcess = null;
let isShuttingDown = false;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(prefix, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${prefix} ${timestamp}]${colors.reset} ${message}`);
}

function cleanup(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('MAIN', `Received ${signal}, shutting down gracefully...`, colors.yellow);

  const killProcess = (proc, name, timeout = 3000) => {
    return new Promise((resolve) => {
      if (!proc || proc.killed) {
        resolve();
        return;
      }

      // Suppress stdout/stderr to avoid ELIFECYCLE messages
      if (proc.stdout) proc.stdout.removeAllListeners();
      if (proc.stderr) proc.stderr.removeAllListeners();

      const killTimer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, timeout);

      proc.once('close', () => {
        clearTimeout(killTimer);
        log(name, 'Process terminated', colors.yellow);
        resolve();
      });

      // Send SIGTERM first, then SIGINT if needed
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGINT');
        }
      }, 1000);
    });
  };

  Promise.all([
    killProcess(backendProcess, 'B'),
    killProcess(frontendProcess, 'F')
  ]).then(() => {
    log('MAIN', 'Development servers stopped successfully', colors.yellow);
    // Use setTimeout to ensure all cleanup is complete before exiting
    setTimeout(() => process.exit(0), 100);
  }).catch((err) => {
    log('MAIN', `Error during cleanup: ${err.message}`, colors.red);
    setTimeout(() => process.exit(1), 100);
  });
}

// Setup signal handlers
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log('MAIN', `Uncaught exception: ${err.message}`, colors.red);
  cleanup();
});

process.on('unhandledRejection', (reason) => {
  log('MAIN', `Unhandled rejection: ${reason}`, colors.red);
  cleanup();
});

function startBackend() {
  return new Promise((resolve, reject) => {
    log('B', 'Starting backend server...', colors.blue);

    backendProcess = spawn('uv', ['run', 'python', 'main.py'], {
      cwd: join(__dirname, '..', 'backend'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    backendProcess.stdout.on('data', (data) => {
      if (isShuttingDown) return;
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => log('B', line, colors.blue));
    });

    backendProcess.stderr.on('data', (data) => {
      if (isShuttingDown) return;
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => log('B', line, colors.blue));
    });

    backendProcess.on('spawn', () => {
      log('B', 'Backend process spawned successfully', colors.blue);
      resolve();
    });

    backendProcess.on('error', (err) => {
      log('B', `Failed to start backend: ${err.message}`, colors.red);
      reject(err);
    });

    backendProcess.on('close', (code, signal) => {
      if (!isShuttingDown) {
        log('B', `Backend process closed with code ${code}, signal ${signal}`, colors.red);
        if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
          cleanup();
        }
      }
    });
  });
}

function startFrontend() {
  return new Promise((resolve, reject) => {
    log('F', 'Starting frontend server...', colors.green);

    frontendProcess = spawn('pnpm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    frontendProcess.stdout.on('data', (data) => {
      if (isShuttingDown) return;
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => log('F', line, colors.green));
    });

    frontendProcess.stderr.on('data', (data) => {
      if (isShuttingDown) return;
      const lines = data.toString().split('\n').filter(line => line.trim());
      // Filter out ELIFECYCLE messages
      const filteredLines = lines.filter(line =>
        !line.includes('ELIFECYCLE') &&
        !line.includes('Command failed')
      );
      filteredLines.forEach(line => log('F', line, colors.green));
    });

    frontendProcess.on('spawn', () => {
      log('F', 'Frontend process spawned successfully', colors.green);
      resolve();
    });

    frontendProcess.on('error', (err) => {
      log('F', `Failed to start frontend: ${err.message}`, colors.red);
      reject(err);
    });

    frontendProcess.on('close', (code, signal) => {
      if (!isShuttingDown) {
        log('F', `Frontend process closed with code ${code}, signal ${signal}`, colors.red);
        if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
          cleanup();
        }
      }
    });
  });
}

async function main() {
  try {
    log('MAIN', 'Starting WeDX development servers...', colors.yellow);
    log('MAIN', `Configuration: Frontend port ${FRONTEND_PORT}, Backend port ${BACKEND_PORT}`, colors.yellow);

    // Start backend first
    await startBackend();

    // Wait a moment for backend to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start frontend
    await startFrontend();

    log('MAIN', 'Both servers started successfully. Press Ctrl+C to stop.', colors.yellow);
    log('MAIN', `Frontend: http://localhost:${FRONTEND_PORT}`, colors.green);
    log('MAIN', `Backend:  http://localhost:${BACKEND_PORT}`, colors.blue);

  } catch (error) {
    log('MAIN', `Failed to start servers: ${error.message}`, colors.red);
    cleanup();
  }
}

main();
