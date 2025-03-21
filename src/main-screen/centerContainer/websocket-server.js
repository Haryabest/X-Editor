import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

// Запуск typescript-language-server через stdio
const serverProcess = spawn('npx', [
  'tsserver',
  '--logVerbosity', 'verbose'
], {
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Логирование для serverProcess
serverProcess.stdout.on('data', (data) => {
  console.log('TypeScript Language Server stdout:', data.toString());
});

serverProcess.stderr.on('data', (data) => {
  console.error('TypeScript Language Server stderr:', data.toString());
});

serverProcess.on('close', (code) => {
  console.log(`TypeScript Language Server process exited with code ${code}`);
});

// Создание WebSocket сервера
const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  ws.on('message', (message) => {
    console.log('Received message from client:', message.toString());
    serverProcess.stdin.write(message + '\n'); // Добавляем символ новой строки
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('Received message from server:', data.toString());
    ws.send(data.toString());
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

console.log('WebSocket server is running on ws://localhost:3000');