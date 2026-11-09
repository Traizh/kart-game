const { WebSocketServer } = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
    console.log('Player connected to lobby');
    
    // Send a confirmation back to the game client so it knows the connection succeeded
    ws.send(JSON.stringify({ type: 'connected' }));
    
    ws.on('message', (message) => {
        // Broadcast game inputs, movement, and room updates to all players
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => console.log('Player disconnected'));
});

console.log(`Kart Chaos multiplayer backend running on port ${port}`);
