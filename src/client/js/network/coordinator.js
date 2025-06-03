// Network coordinator class for P2P communication
window.NetworkCoordinator = class NetworkCoordinator {
    constructor() {
        this.peers = new Map(); // userId -> peer info
        this.isHost = false;
        this.hostId = null;
        this.gameState = null;
        this.hostGame = null;
        this.lastElectionTimestamp = 0;
        this.gameStateInterval = null;
        this.lastMessageTime = 0;
        this.messageRateLimit = 200; // Minimum 200ms between messages (5 per second)
        this.setupPulgramBridge();
    }

    setupPulgramBridge() {
        if (!window.pulgram) {
            console.error('Pulgram bridge not initialized');
            return;
        }

        window.pulgram.setOnMessageReceivedListener((message) => {
            this.handleMessage(message);
        });
    }
      handleMessage(message) {
        try {
            console.log('Message received:', message);
            
            // Handle different message formats (string vs object)
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            
            // Check if message is from Pulgram
            if (data.type && data.type !== 'APP_DATA') {
                console.warn('Received non-APP_DATA message:', data);
                return;
            }
            
            // Extract message content based on format
            let messageType, content;
            if (data.content && data.content.messageType) {
                // Standard Pulgram format
                messageType = data.content.messageType;
                content = data.content.data;
            } else if (data.messageType) {
                // Direct message format (from broadcastMessage)
                messageType = data.messageType;
                content = data.data;
            } else {
                console.warn('Unknown message format:', data);
                return;
            }
            
            console.log('Processing message:', messageType, content);
            
            // Route message to appropriate handler
            switch (messageType) {
                case 'HOST_ELECTION':
                    this.handleHostElection(content);
                    break;
                case 'GAME_STATE':
                    this.handleGameState(content);
                    break;
                case 'PLAYER_ACTION':
                    this.handlePlayerAction(content);
                    break;
                case 'PLAYER_JOIN':
                    this.handlePlayerJoin(content);
                    break;
                case 'PLAYER_LEAVE':
                    this.handlePlayerLeave(content);
                    break;
                default:
                    console.warn('Unknown message type:', messageType);
            }
        } catch (e) {
            console.error('Error handling message:', e, message);
        }
    }becomeHost() {
        console.log('I am now the host');
        this.isHost = true;
        this.hostId = window.pulgram.getUserId();
        
        try {
            if (window.HostGame) {
                this.hostGame = new window.HostGame();
                console.log('Host game created:', this.hostGame);
                
                window.global.disconnected = false; // Reset disconnect state when new host is elected
                
                // Add ourselves to the game first
                const myData = {
                    name: window.global.playerName,
                    type: window.global.playerType,
                    screenWidth: window.global.screen.width,
                    screenHeight: window.global.screen.height
                };
                
                // Initialize current player in the game
                this.handlePlayerJoin({
                    userId: window.pulgram.getUserId(),
                    playerData: myData
                });
                
                // Start the game when becoming host
                this.hostGame.startGame();
                
                // Start the game state update loop
                if (this.gameStateInterval) {
                    clearInterval(this.gameStateInterval);
                }
                this.gameStateInterval = setInterval(() => this.broadcastGameState(), 1000 / 30); // 30fps updates
                
                console.log('Host game initialization complete');
            } else {
                console.error('HostGame class not found in window object');
            }
        } catch (err) {
            console.error('Error becoming host:', err);
        }
    }    broadcastGameState() {
        if (!this.isHost) {
            console.log('Not broadcasting game state because not host');
            return;
        }
        
        if (!this.hostGame) {
            console.error('Cannot broadcast game state: hostGame is undefined');
            return;
        }
        
        try {
            // Update game state
            this.hostGame.updateGameState();
            const state = this.hostGame.getGameState();
            
            if (!state) {
                console.error('Failed to get game state from hostGame');
                return;
            }
            
            console.log('Broadcasting game state:', {
                players: Object.keys(state.players).length,
                food: state.food.length,
                viruses: state.viruses.length,
                massFood: state.massFood.length
            });
            
            // Update our local state first
            this.updateLocalGameState(state);
            
            // Broadcast to peers
            this.broadcastMessage('GAME_STATE', state);
        } catch (err) {
            console.error('Error broadcasting game state:', err);
        }
    }
    updateLocalGameState(state) {
        if (!state) {
            console.warn('Invalid game state received');
            return;
        }

        // If we're host, use the state directly from hostGame
        if (this.isHost && this.hostGame) {
            state = this.hostGame.getGameState();
        }        // Update food with proper properties
        window.foods = Array.isArray(state.food) ? state.food.map(food => ({
            x: food.x,
            y: food.y,
            radius: food.radius || window.util.massToRadius(food.mass),
            mass: food.mass || window.config.foodMass,
            hue: food.hue || Math.round(Math.random() * 360)
        })) : [];

        // Update viruses with proper properties
        window.viruses = Array.isArray(state.viruses) ? state.viruses.map(virus => ({
            x: virus.x,
            y: virus.y,
            mass: virus.mass,
            radius: virus.radius || window.util.massToRadius(virus.mass),
            fill: virus.fill || window.config.virus.fill,
            stroke: virus.stroke || window.config.virus.stroke,
            strokeWidth: virus.strokeWidth || window.config.virus.strokeWidth
        })) : [];

        // Update ejected mass
        window.fireFood = Array.isArray(state.massFood) ? state.massFood : [];        // Update player data
        let myState;
        if (this.isHost && this.hostGame && this.hostGame.players) {
            myState = this.hostGame.players.get(window.pulgram.getUserId());
        } else if (state.players) {
            myState = state.players[window.pulgram.getUserId()];
        }
        if (myState) {
                window.player = {
                    id: myState.id,
                    x: myState.x,
                    y: myState.y,
                    cells: myState.cells.map(cell => ({
                        x: cell.x,
                        y: cell.y,
                        mass: cell.mass,
                        radius: cell.radius || window.util.massToRadius(cell.mass),
                        hue: cell.hue,
                        name: myState.name
                    })),
                    hue: myState.hue,
                    name: myState.name
                };
            }            // Update other players
            if (this.isHost && this.hostGame && this.hostGame.players instanceof Map) {
                try {
                    window.users = Array.from(this.hostGame.players.entries())
                        .filter(([id]) => id !== window.pulgram.getUserId())
                        .map(([, user]) => ({
                        id: user.id,
                        x: user.x,
                        y: user.y,
                        cells: Array.isArray(user.cells) ? user.cells.map(cell => ({
                            x: cell.x,
                            y: cell.y,
                            mass: cell.mass,
                            radius: cell.radius || window.util.massToRadius(cell.mass),
                            hue: cell.hue,
                            name: user.name
                        })) : [{
                            x: user.x,
                            y: user.y,
                            mass: user.mass || window.config.defaultPlayerMass,
                            radius: window.util.massToRadius(user.mass || window.config.defaultPlayerMass),
                            hue: user.hue,
                            name: user.name
                        }],
                        hue: user.hue,
                        name: user.name
                    }));                } catch (err) {
                    console.error('Error updating other players:', err);
                    window.users = [];
                }
            } else {
                // For non-host players, update window.users from the state
                if (state.players) {
                    window.users = Object.entries(state.players)
                        .filter(([id]) => id !== window.pulgram.getUserId())
                        .map(([, user]) => ({
                            id: user.id,
                            x: user.x,
                            y: user.y,
                            cells: Array.isArray(user.cells) ? user.cells.map(cell => ({
                                x: cell.x,
                                y: cell.y,
                                mass: cell.mass,
                                radius: cell.radius || window.util.massToRadius(cell.mass),
                                hue: cell.hue,
                                name: user.name
                            })) : [{
                                x: user.x,
                                y: user.y,
                                mass: user.mass || window.config.defaultPlayerMass,
                                radius: window.util.massToRadius(user.mass || window.config.defaultPlayerMass),
                                hue: user.hue,
                                name: user.name
                            }],
                            hue: user.hue,
                            name: user.name
                        }));
                }
            }
        
    }    handleGameState(content) {
        console.log('Handling game state:', content);
        
        if (!this.isHost) {
            // Only non-host players should process received game state
            this.updateLocalGameState(content);
            
            // Make sure essential game objects are initialized
            if (!window.foods || !Array.isArray(window.foods)) {
                window.foods = [];
            }
            if (!window.viruses || !Array.isArray(window.viruses)) {
                window.viruses = [];
            }
            if (!window.fireFood || !Array.isArray(window.fireFood)) {
                window.fireFood = [];
            }
            if (!window.users || !Array.isArray(window.users)) {
                window.users = [];
            }
            
            // Update global game dimensions
            if (content.gameWidth && content.gameHeight) {
                global.game.width = content.gameWidth;
                global.game.height = content.gameHeight;
            }
            
            // Ensure game has started
            global.gameStart = true;
            
            // Call the onGameStateUpdate callback if it exists
            if (typeof this.onGameStateUpdate === 'function') {
                this.onGameStateUpdate(content);
            }
        }
    }

    handlePlayerJoin(content) {
        const { userId, playerData } = content;
        console.log('Player joining:', userId, playerData);
        
        if (this.isHost && this.hostGame) {
            this.hostGame.addPlayer(userId, playerData);
            // Immediately send current game state to all players
            const state = this.hostGame.getGameState();
            this.broadcastMessage('GAME_STATE', state);
        }
        
        this.peers.set(userId, playerData);
    }

    handlePlayerAction(content) {
        const { userId, action, params } = content;
        
        if (this.isHost && this.hostGame) {
            switch (action) {
                case 'move':
                    this.hostGame.updatePlayerTarget(userId, params);
                    break;
                case 'split':
                    // TODO: Implement split action
                    break;
                case 'eject':
                    // TODO: Implement eject action
                    break;
            }
        }
    }

    handlePlayerLeave(content) {
        const { userId } = content;
        if (this.isHost && this.hostGame) {
            this.hostGame.removePlayer(userId);
        }
        this.peers.delete(userId);
    }

    // Host Election
    startHostElection() {
        // Get our timestamp
        const myTimestamp = Date.now();
        this.lastElectionTimestamp = myTimestamp;
        
        // Broadcast our timestamp
        this.broadcastMessage('HOST_ELECTION', {
            userId: window.pulgram.getUserId(),
            timestamp: myTimestamp
        });
        
        // Wait a short time to collect other timestamps
        setTimeout(() => {
            // If we haven't received any messages with earlier timestamps, become host
            if (this.lastElectionTimestamp === myTimestamp) {
                this.becomeHost();
            }
        }, 1000);
    }

    handleHostElection(content) {
        const { userId, timestamp } = content;
        
        // If we receive a timestamp earlier than ours, they become host
        if (!this.hostId || timestamp < this.lastElectionTimestamp) {
            this.hostId = userId;
            this.lastElectionTimestamp = timestamp;
            this.isHost = (userId === window.pulgram.getUserId());
            
            if (this.isHost) {
                this.becomeHost();
            }
        }
    }    


    broadcastMessage(type, content) {
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        
        // Check if enough time has passed since the last message
        if (timeSinceLastMessage < this.messageRateLimit) {
            console.log(`Dropping message of type: ${type} due to rate limiting`);
            return;
        }
        
        const message = {
            messageType: type,
            data: content,
            timestamp: now
        };
        
        // Send message and update last message timestamp
        if (window.pulgram) {
            window.pulgram.sendMessage(message);
            this.lastMessageTime = now;

        }
    }
}

// Export for use in other files
window.NetworkCoordinator = NetworkCoordinator;
