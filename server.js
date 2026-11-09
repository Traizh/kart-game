const { WebSocketServer } = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocketServer({ port });

// Keep track of active multiplayer rooms
const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('A player connected to the network');
    let currentRoom = null;
    let playerId = Math.random().toString(36).substring(2, 9);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle different game network signals
            switch(data.type) {
                case 'join':
                    currentRoom = data.room || playerId;
                    if (!rooms.has(currentRoom)) {
                        rooms.set(currentRoom, new Set());
                    }
                    rooms.get(currentRoom).add(ws);
                    ws.currentRoom = currentRoom;
                    
                    // Reply back to client confirming room registration
                    ws.send(JSON.stringify({ 
                        type: 'id', 
                        id: playerId, 
                        room: currentRoom 
                    }));
                    console.log(`Player ${playerId} joined room: ${currentRoom}`);
                    break;
                    
                default:
                    // Broadcast movements, actions, and items to other players in the same room
                    if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                        rooms.get(ws.currentRoom).forEach((client) => {
                            if (client !== ws && client.readyState === 1) {
                                client.send(message.toString());
                            }
                        });
                    }
                    break;
            }
        } catch (e) {
            // Fallback for raw/string formats
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                rooms.get(ws.currentRoom).forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                        client.send(message.toString());
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        console.log(`Player ${playerId} disconnected`);
        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
            rooms.get(ws.currentRoom).delete(ws);
            if (rooms.get(ws.currentRoom).size === 0) {
                rooms.delete(ws.currentRoom);
            }
        }
    });
});

console.log(`Kart Chaos multiplayer backend running on port ${port}`);
