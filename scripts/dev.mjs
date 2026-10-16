// Starts the Vite dev server and opens the app in Electron with hot reload.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electronPath from 'electron';
import { buildElectron } from './electron.mjs';

const server = await createServer();
await server.listen();
await buildElectron();

const app = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: server.resolvedUrls.local[0] },
});
app.on('exit', code => { server.close(); process.exit(code ?? 0); });
