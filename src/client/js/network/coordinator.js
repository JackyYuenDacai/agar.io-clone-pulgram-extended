class NetworkCoordinator {
    constructor() {
        this.peers = new Map(); // userId -> peer info
        this.isHost = false;
        this.hostId = null;
        this.gameState = null;
        this.hostGame = null;
        this.lastElectionTimestamp = 0;
        this.gameStateInterval = null;
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
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            if (data.type !== 'APP_DATA') {
                console.warn('Received non-APP_DATA message:', data);
                return;
            }

            const { messageType, data: content } = data.content;
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
            }
        } catch (e) {
            console.error('Error handling message:', e);
        }
    }

    becomeHost() {
        console.log('I am now the host');
        this.isHost = true;
        this.hostId = window.pulgram.getUserId();
        this.hostGame = new window.HostGame();
        
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

        // Start the game state update loop
        if (this.gameStateInterval) {
            clearInterval(this.gameStateInterval);
        }
        this.gameStateInterval = setInterval(() => this.broadcastGameState(), 1000 / 30); // 30fps updates
    }

    broadcastGameState() {
        if (!this.isHost || !this.hostGame) return;
        
        // Update game state
        this.hostGame.updateGameState();
        const state = this.hostGame.getGameState();
        
        // Update our local state first
        this.updateLocalGameState(state);
        
        // Broadcast to peers
        this.broadcastMessage('GAME_STATE', state);
    }    updateLocalGameState(state) {
        if (!state) {
            console.warn('Invalid game state received');
            return;
        }

        // Update food with proper properties
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
        window.fireFood = Array.isArray(state.massFood) ? state.massFood : [];
        
        // Update player data if we're not the host
        if (!this.isHost) {
            const myState = state.players.get(window.pulgram.getUserId());
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
            }

            // Update other players
            window.users = Array.from(state.players.entries())
                .filter(([id]) => id !== window.pulgram.getUserId())
                .map(([, user]) => ({
                    id: user.id,
                    x: user.x,
                    y: user.y,
                    cells: user.cells.map(cell => ({
                        x: cell.x,
                        y: cell.y,
                        mass: cell.mass,
                        radius: cell.radius || window.util.massToRadius(cell.mass),
                        hue: cell.hue,
                        name: user.name
                    })),
                    hue: user.hue,
                    name: user.name
                }));
        }
    }

    handleGameState(content) {
        if (this.isHost) return; // Host maintains its own state
        this.updateLocalGameState(content);
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
        const message = window.pulgram.createMessage({
            type: 'APP_DATA',
            content: {
                messageType: type,
                data: content,
                timestamp: Date.now()
            }
        }, window.pulgram.MessageType.GAME_MOVE);
        window.pulgram.sendMessage(message);
    }
}

// Export for use in other files
window.NetworkCoordinator = NetworkCoordinator;
