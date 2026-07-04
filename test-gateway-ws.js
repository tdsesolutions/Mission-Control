const WebSocket = require('ws');

const GATEWAY_URL = 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = 'b240d96986c4cb753e9a4dc33217507e0c4a42163dc20c47';

const ws = new WebSocket(GATEWAY_URL);

let connectSent = false;
let requestSent = false;

ws.on('open', () => {
  console.log('[INFO] WebSocket connected');
});

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString());
  console.log('[RECV]', JSON.stringify(frame, null, 2));

  if (frame.type === 'event' && frame.event === 'connect.challenge') {
    // Send connect response with token
    const connectFrame = {
      type: 'req',
      method: 'connect',
      id: 'test-connect-1',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'phase7-test-client',
          displayName: 'Phase 7 Gateway Test',
          version: '1.0.0',
          platform: 'test',
          mode: 'backend',
          instanceId: 'phase7-test'
        },
        role: 'operator',
        scopes: ['operator.admin', 'operator.write', 'operator.read'],
        caps: ['tool-events'],
        auth: { token: GATEWAY_TOKEN }
      }
    };
    console.log('[SEND] connect frame');
    ws.send(JSON.stringify(connectFrame));
    connectSent = true;
  }

  if (frame.type === 'res' && frame.id === 'test-connect-1') {
    if (frame.ok) {
      console.log('[SUCCESS] Authentication successful!');
      
      // Now test the 'agent' method
      const agentFrame = {
        type: 'req',
        method: 'agent',
        id: 'test-agent-1',
        params: {
          message: 'Create a file at ~/Desktop/AI-Lab/Mission-Control/SANDBOX/PHASE7_SUCCESS.txt with content "Gateway delivery validated successfully. Timestamp: ' + new Date().toISOString() + '. Executing agent: main. Execution path: Mission Control → Gateway → OpenClaw Main Agent."',
          agentId: 'main',
          idempotencyKey: 'phase7-test-' + Date.now(),
          deliver: false
        }
      };
      console.log('[SEND] agent method frame');
      ws.send(JSON.stringify(agentFrame));
      requestSent = true;
    } else {
      console.log('[FAILED] Authentication failed:', frame.error);
      ws.close();
      process.exit(1);
    }
  }

  if (frame.type === 'res' && frame.id === 'test-agent-1') {
    if (frame.ok) {
      console.log('[SUCCESS] Agent method accepted!');
      console.log('[RESULT]', JSON.stringify(frame.result, null, 2));
    } else {
      console.log('[FAILED] Agent method failed:', frame.error);
    }
    ws.close();
    process.exit(frame.ok ? 0 : 1);
  }
});

ws.on('error', (err) => {
  console.log('[ERROR]', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('[INFO] WebSocket closed');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('[TIMEOUT] Test timed out after 30 seconds');
  ws.close();
  process.exit(1);
}, 30000);
