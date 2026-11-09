const { WebSocketServer } = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocketServer({ port });

const rooms = new Map();
let globalPlayerCounter = 1000;

wss.on('connection', (ws) => {
    console.log('Player linked to socket channel');
    
    // Assign a clear numeric ID just like the game expects
    const playerId = globalPlayerCounter++;
    let currentRoomId = null;
    let playerNickname = "Driver";

    // STEP 1: Immediately send the mandatory handshake your code demands
    ws.send(JSON.stringify({
        t: 'hello',
        id: playerId
    }));

    ws.on('message', (message) => {
        try {
            const m = JSON.parse(message);
            
            // Handle actions arriving from your local file functions
            if (m.t === 'join' || m.t === 'create' || m.type === 'join' || m.action === 'join') {
                playerNickname = m.name || "Player " + playerId;
                
                // Use the requested room name, or auto-generate one for host creation
                currentRoomId = m.room || "ROOM-" + Math.floor(100 + Math.random() * 900);
                
                if (!rooms.has(currentRoomId)) {
                    rooms.set(currentRoomId, new Map());
                }
                
                const roomPlayers = rooms.get(currentRoomId);
                
                // Save client reference alongside metadata
                roomPlayers.set(playerId, { ws, name: playerNickname, id: playerId });
                ws.currentRoom = currentRoomId;
                ws.playerId = playerId;

                // Build the structural array your m.players.forEach loop requires
                const playersArray = [];
                roomPlayers.forEach((player) => {
                    playersArray.push({ id: player.id, name: player.name });
                });

                // STEP 2: Confirm connection using the game's strict data model layout
                ws.send(JSON.stringify({
                    t: 'joined',
                    room: currentRoomId,
                    id: playerId,
                    players: playersArray
                }));

                // Alert existing drivers in that matching race room
                roomPlayers.forEach((player) => {
                    if (player.id !== playerId && player.ws.readyState === 1) {
                        player.ws.send(JSON.stringify({
                            t: 'peer_join',
                            id: playerId,
                            name: playerNickname
                        }));
                    }
                });

                console.log(`Driver ${playerNickname} (${playerId}) initialized into room: ${currentRoomId}`);
                return;
            }

            // Standard synchronization relay fallback (state adjustments, driving telemetry, item triggers)
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                const roomPlayers = rooms.get(ws.currentRoom);
                roomPlayers.forEach((player) => {
                    if (player.id !== ws.playerId && player.ws.readyState === 1) {
                        // Inject sender's id directly into the incoming structure payload 
                        m.id = ws.playerId; 
                        player.ws.send(JSON.stringify(m));
                    }
                });
            }

        } catch (err) {
            // Forward raw text payloads across matching lobby targets
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                rooms.get(ws.currentRoom).forEach((player) => {
                    if (player.id !== ws.playerId && player.ws.readyState === 1) {
                        player.ws.send(message.toString());
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        console.log(`Driver ${playerId} disconnected`);
        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
            const roomPlayers = rooms.get(ws.currentRoom);
            roomPlayers.delete(playerId);

            // Alert the remaining users so peer_leave can strip away their kart objects
            roomPlayers.forEach((player) => {
                if (player.ws.readyState === 1) {
                    player.ws.send(JSON.stringify({
                        t: 'peer_leave',
                        id: playerId
                    }));
                }
            });

            if (roomPlayers.size === 0) {
                rooms.delete(ws.currentRoom);
            }
        }
    });
});

console.log(`Kart Chaos matching gateway engine listening on port ${port}`);
