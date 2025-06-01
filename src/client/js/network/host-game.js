// Host game logic for P2P gameplay
(function() {
    class HostGame {
        constructor() {
            this.lastStateUpdate = 0;
            this.STATE_UPDATE_INTERVAL = 100; // 10 updates per second
            this.gameState = {
                players: new Map(),
                food: [],
                viruses: [],
                massFood: [],
                leaderboard: [],
                gameWidth: window.config.gameWidth,
                gameHeight: window.config.gameHeight
            };
            this.gameLoopId = null;
            this.isRunning = false;
            this.initializeMap();
            this.gameLoop = this.gameLoop.bind(this);
        }

        initializeMap() {
            // Initialize food
            for (let i = 0; i < window.config.maxFood; i++) {
                this.gameState.food.push({
                    x: Math.random() * this.gameState.gameWidth,
                    y: Math.random() * this.gameState.gameHeight,
                    radius: window.util.massToRadius(window.config.foodMass),
                    mass: window.config.foodMass,
                    hue: Math.round(Math.random() * 360)  // Make sure to set hue
                });
            }

            // Initialize viruses
            for (let i = 0; i < window.config.maxVirus; i++) {
                const mass = window.util.randomInRange(window.config.virus.defaultMass.from, window.config.virus.defaultMass.to);
                this.gameState.viruses.push({
                    x: Math.random() * this.gameState.gameWidth,
                    y: Math.random() * this.gameState.gameHeight,
                    mass: mass,
                    radius: window.util.massToRadius(mass),
                    fill: window.config.virus.fill,
                    stroke: window.config.virus.stroke,
                    strokeWidth: window.config.virus.strokeWidth
                });
            }
        }

        addPlayer(userId, playerData) {
            console.log('Adding player:', userId, playerData);
            const spawnPoint = {
                x: Math.random() * this.gameState.gameWidth,
                y: Math.random() * this.gameState.gameHeight
            };

            const player = {
                id: userId,
                name: playerData.name,
                x: spawnPoint.x,
                y: spawnPoint.y,
                mass: window.config.defaultPlayerMass,
                cells: [{
                    x: spawnPoint.x,
                    y: spawnPoint.y,
                    mass: window.config.defaultPlayerMass,
                    radius: window.util.massToRadius(window.config.defaultPlayerMass)
                }],
                hue: Math.random() * 360,
                type: playerData.type,
                screenWidth: playerData.screenWidth,
                screenHeight: playerData.screenHeight,
                lastHeartbeat: Date.now(),
                target: { x: spawnPoint.x, y: spawnPoint.y }
            };
            
            this.gameState.players.set(userId, player);
            console.log('Player added:', player);
        }

        removePlayer(userId) {
            this.gameState.players.delete(userId);
        }

        updatePlayerTarget(userId, target) {
            const player = this.gameState.players.get(userId);
            if (player) {
                if (!player.target) player.target = {};
                // Convert screen coordinates to game world coordinates
                player.target.x = player.x + (target.x - window.global.screen.width / 2);
                player.target.y = player.y + (target.y - window.global.screen.height / 2);
                player.lastHeartbeat = Date.now();
            }
        }

        updateGameState() {
            this.updatePlayers();
            this.handleCollisions();
            this.balanceMass();
            this.updateLeaderboard();
        }

        updatePlayers() {
            for (let [userId, player] of this.gameState.players) {
                // Check timeout
                if (Date.now() - player.lastHeartbeat > window.config.maxHeartbeatInterval) {
                    this.removePlayer(userId);
                    continue;
                }

                // Update player position
                if (player.target && player.cells) {
                    player.cells.forEach(cell => {
                        const dx = player.target.x - cell.x;
                        const dy = player.target.y - cell.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < 1) return;

                        const speed = Math.min(dist / 10, 30);
                        const nx = (dx / dist) * speed;
                        const ny = (dy / dist) * speed;

                        // Update cell position
                        cell.x = Math.max(cell.radius, Math.min(this.gameState.gameWidth - cell.radius, cell.x + nx));
                        cell.y = Math.max(cell.radius, Math.min(this.gameState.gameHeight - cell.radius, cell.y + ny));
                    });

                    // Update player position to center of mass
                    if (player.cells.length > 0) {
                        player.x = player.cells.reduce((sum, cell) => sum + cell.x, 0) / player.cells.length;
                        player.y = player.cells.reduce((sum, cell) => sum + cell.y, 0) / player.cells.length;
                    }
                }

                // Mass loss over time
                if (!player.lastMassLoss || Date.now() - player.lastMassLoss > 1000) {
                    player.cells.forEach(cell => {
                        cell.mass = Math.max(window.config.defaultPlayerMass, cell.mass - window.config.massLossRate);
                        cell.radius = window.util.massToRadius(cell.mass);
                    });
                    player.lastMassLoss = Date.now();
                }
            }
        }

        handleCollisions() {
            // Simplified collision detection
            for (let [, player] of this.gameState.players) {
                player.cells.forEach(cell => {
                    // Check food collisions
                    this.gameState.food = this.gameState.food.filter(food => {
                        const dx = cell.x - food.x;
                        const dy = cell.y - food.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < cell.radius) {
                            cell.mass += food.mass;
                            cell.radius = window.util.massToRadius(cell.mass);
                            return false;
                        }
                        return true;
                    });

                    // Check virus collisions
                    this.gameState.viruses.forEach(virus => {
                        const dx = cell.x - virus.x;
                        const dy = cell.y - virus.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < cell.radius && cell.mass > virus.mass) {
                            this.splitCell(player, cell);
                        }
                    });
                });
            }
        }

        splitCell(player, cell) {
            if (player.cells.length >= window.config.limitSplit) return;

            const angle = Math.random() * Math.PI * 2;
            const newCell = {
                x: cell.x,
                y: cell.y,
                mass: cell.mass / 2,
                radius: window.util.massToRadius(cell.mass / 2),
                velocity: {
                    x: Math.cos(angle) * 25,
                    y: Math.sin(angle) * 25
                }
            };
            cell.mass /= 2;
            cell.radius = window.util.massToRadius(cell.mass);
            player.cells.push(newCell);
        }

        balanceMass() {
            // Add food if needed
            while (this.gameState.food.length < window.config.maxFood) {
                this.gameState.food.push({
                    x: Math.random() * this.gameState.gameWidth,
                    y: Math.random() * this.gameState.gameHeight,
                    radius: window.util.massToRadius(window.config.foodMass),
                    mass: window.config.foodMass,
                    hue: Math.round(Math.random() * 360)  // Make sure to set hue
                });
            }

            // Add viruses if needed
            while (this.gameState.viruses.length < window.config.maxVirus) {
                this.gameState.viruses.push({
                    x: Math.random() * this.gameState.gameWidth,
                    y: Math.random() * this.gameState.gameHeight,
                    mass: window.util.randomInRange(window.config.virus.defaultMass.from, window.config.virus.defaultMass.to)
                });
            }
        }

        updateLeaderboard() {
            const players = Array.from(this.gameState.players.values());
            players.sort((a, b) => {
                const massA = a.cells.reduce((sum, cell) => sum + cell.mass, 0);
                const massB = b.cells.reduce((sum, cell) => sum + cell.mass, 0);
                return massB - massA;
            });
            
            this.gameState.leaderboard = players.slice(0, 10).map(p => ({
                id: p.id,
                name: p.name,
                mass: p.cells.reduce((sum, cell) => sum + cell.mass, 0)
            }));
        }

        getGameState() {
            return this.gameState;
        }

        startGame() {
            if (!this.isRunning) {
                this.isRunning = true;
                this.gameLoop();
            }
        }

        stopGame() {
            this.isRunning = false;
            if (this.gameLoopId) {
                clearTimeout(this.gameLoopId);
                this.gameLoopId = null;
            }
        }

        gameLoop() {
            if (!this.isRunning) return;

            // Update game state
            this.updateGameState();
            
            // Broadcast game state with rate limiting
            const now = Date.now();
            if (now - this.lastStateUpdate >= this.STATE_UPDATE_INTERVAL) {
                this.broadcastGameState();
                this.lastStateUpdate = now;
            }
            
            // Continue game loop using requestAnimationFrame for smoother animation
            this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
        }

        broadcastGameState() {
            const state = {
                players: new Map(),
                food: this.gameState.food,
                viruses: this.gameState.viruses,
                massFood: this.gameState.massFood,
                leaderboard: this.gameState.leaderboard
            };

            // Add host player state
            if (window.player) {
                state.players.set(window.pulgram.getUserId(), {
                    id: window.pulgram.getUserId(),
                    x: window.player.x,
                    y: window.player.y,
                    cells: window.player.cells,
                    mass: window.player.mass,
                    hue: window.player.hue,
                    name: window.player.name
                });
            }

            // Add other players
            Array.from(this.gameState.players.values()).forEach(player => {
                if (player.id !== window.pulgram.getUserId()) {
                    state.players.set(player.id, player);
                }
            });

            // Broadcast state to all peers
            window.pulgram.broadcast('gameState', state);
        }
    }

    // Export to window object
    window.HostGame = HostGame;
})();
