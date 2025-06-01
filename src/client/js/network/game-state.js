// Game state management
window.GameState = {
    width: 5000,
    height: 5000,
    players: new Map(),
    food: [],
    viruses: [],
    
    initialize() {
        // Initialize food
        for (let i = 0; i < 1000; i++) {
            this.food.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                mass: 1
            });
        }
    },

    generateSpawnPoint() {
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height
        };
    },

    updatePlayers() {
        for (const [userId, player] of this.players.entries()) {
            if (player.target) {
                for (const cell of player.cells) {
                    const dx = player.target.x - cell.x;
                    const dy = player.target.y - cell.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0) {
                        const speed = Math.min(dist / 10, 30);
                        cell.x += (dx / dist) * speed;
                        cell.y += (dy / dist) * speed;

                        // Keep in bounds
                        cell.x = Math.max(0, Math.min(this.width, cell.x));
                        cell.y = Math.max(0, Math.min(this.height, cell.y));
                    }
                }
            }
        }
    },

    checkCollisions() {
        for (const [userId, player] of this.players.entries()) {
            for (const cell of player.cells) {
                this.food = this.food.filter(food => {
                    const dx = cell.x - food.x;
                    const dy = cell.y - food.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < cell.radius) {
                        cell.mass += food.mass;
                        cell.radius = Math.sqrt(cell.mass) * 4;
                        return false;
                    }
                    return true;
                });
            }
        }

        // Replenish food
        while (this.food.length < 1000) {
            this.food.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                mass: 1
            });
        }
    },

    splitPlayer(userId) {
        const player = this.players.get(userId);
        if (!player || player.cells.length >= 16) return;

        const newCells = [];
        for (const cell of player.cells) {
            if (cell.mass >= 20) {
                const angle = Math.random() * Math.PI * 2;
                const newMass = cell.mass / 2;
                
                cell.mass = newMass;
                cell.radius = Math.sqrt(newMass) * 4;

                newCells.push({
                    x: cell.x,
                    y: cell.y,
                    mass: newMass,
                    radius: Math.sqrt(newMass) * 4,
                    velocity: {
                        x: Math.cos(angle) * 25,
                        y: Math.sin(angle) * 25
                    }
                });
            }
        }

        player.cells.push(...newCells);
    },

    ejectMass(userId) {
        const player = this.players.get(userId);
        if (!player) return;

        for (const cell of player.cells) {
            if (cell.mass >= 20) {
                cell.mass -= 10;
                cell.radius = Math.sqrt(cell.mass) * 4;

                this.food.push({
                    x: cell.x,
                    y: cell.y,
                    mass: 10,
                    velocity: {
                        x: (cell.x - player.target.x) * 10,
                        y: (cell.y - player.target.y) * 10
                    }
                });
            }
        }
    }
};
