import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { spawn } from 'child_process';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  const childProcess = spawn('typescript-language-server', [
    '--stdio',
    '--tsserver-path=node_modules/typescript/lib/tsserver.js'
  ]);

  const reader = new StreamMessageReader(childProcess.stdout!);
  const writer = new StreamMessageWriter(childProcess.stdin!);

  reader.listen((message) => {
    ws.send(JSON.stringify(message));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    writer.write(message);
  });

  ws.on('close', () => {
    childProcess.kill();
  });
});

server.listen(3000, () => {
  console.log('LSP server running on ws://localhost:3000');
});