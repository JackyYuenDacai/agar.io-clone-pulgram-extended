window.addEventListener('load', function() {
    // Pre-initialize game state
    window.GameState = {
        width: 5000,
        height: 5000,
        players: new Map(),
        food: [],
        viruses: []
    };
    
    // Initialize coordinator
    window.gameCoordinator = new window.NetworkCoordinator();
});
