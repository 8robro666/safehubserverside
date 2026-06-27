const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());
app.use(express.static('.'));

const KEYS_FILE = path.join(__dirname, 'keys.json');

function loadKeys() {
    if (!fs.existsSync(KEYS_FILE)) {
        fs.writeFileSync(KEYS_FILE, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(KEYS_FILE));
}

function saveKeys(keys) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 4));
}

function validateKey(key) {
    const keys = loadKeys();
    
    if (!keys[key]) {
        return { valid: false, reason: 'Invalid key' };
    }
    
    const data = keys[key];
    const expiry = new Date(data.expires_at);
    const now = new Date();
    
    if (!data.active) {
        return { valid: false, reason: 'Key has been revoked' };
    }
    
    if (expiry < now) {
        return { valid: false, reason: 'Key has expired' };
    }
    
    if (data.uses >= data.max_uses) {
        return { valid: false, reason: 'Key has reached maximum uses' };
    }
    
    return { valid: true, data: data };
}

function useKey(key) {
    const keys = loadKeys();
    
    if (!keys[key]) {
        return false;
    }
    
    keys[key].uses += 1;
    saveKeys(keys);
    return true;
}

let serverData = {
    servers: []
};

app.post('/api/validate', (req, res) => {
    const { key } = req.body;
    
    if (!key) {
        return res.json({ valid: false, reason: 'No key provided' });
    }
    
    const validation = validateKey(key);
    
    if (validation.valid) {
        useKey(key);
        res.json({ valid: true, message: 'Key validated successfully' });
    } else {
        res.json({ valid: false, reason: validation.reason });
    }
});

app.post('/api/update', (req, res) => {
    const data = req.body;
    const existingIndex = serverData.servers.findIndex(s => s.serverId === data.serverId);
    
    if (existingIndex !== -1) {
        serverData.servers[existingIndex] = data;
    } else {
        serverData.servers.push(data);
    }
    
    broadcastData();
    res.json({ status: 'ok' });
});

app.get('/api/servers', (req, res) => {
    res.json(serverData);
});

app.get('/api/command', (req, res) => {
    const serverId = req.query.serverId;
    const commands = [];
    
    res.json({ commands: commands });
});

app.post('/api/command/result', (req, res) => {
    res.json({ status: 'ok' });
});

function broadcastData() {
    const message = JSON.stringify(serverData);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    ws.send(JSON.stringify(serverData));
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Safe Hub server running on http://localhost:${PORT}`);
    console.log(`Keys file: ${KEYS_FILE}`);
});
