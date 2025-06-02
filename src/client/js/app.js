var render = window.render;
var ChatClient = window.ChatClient;
var Canvas = window.Canvas;
var global = window.global;

var playerNameInput = document.getElementById('playerNameInput');
var socket;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

const initPlayer = (name) => {
    const x = Math.round(Math.random() * window.config.gameWidth);
    const y = Math.round(Math.random() * window.config.gameHeight);
    const hue = Math.round(Math.random() * 360);
    const mass = window.config.defaultPlayerMass;
    const radius = window.util.massToRadius(mass);
    
    window.player = {
        id: window.pulgram.getUserId(),
        x: x,
        y: y,
        hue: hue,
        name: name,
        mass: mass,
        cells: [{
            x: x,
            y: y,
            mass: mass,
            radius: radius,
            hue: hue,
            name: name
        }],
        target: { x: global.screen.width / 2, y: global.screen.height / 2 }
    };

    console.log('Player initialized:', window.player);
    return window.player;
};

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    // Set up screen dimensions
    global.screen = {
        width: window.innerWidth,
        height: window.innerHeight
    };

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;

    if (window.animLoopHandle) {
        window.cancelAnimationFrame(window.animLoopHandle);
        window.animLoopHandle = null;
    }

    window.canvas = new Canvas();
    c = window.canvas.cv;
    graph = c.getContext('2d');

    // Initialize the game loop
    global.gameStart = true;
    window.animLoopHandle = window.requestAnimationFrame(gameLoop);

    // Initialize player data
    const spawnPoint = {
        x: Math.random() * window.config.gameWidth,
        y: Math.random() * window.config.gameHeight
    };

    window.player = {
        id: window.pulgram.getUserId(),
        x: spawnPoint.x,
        y: spawnPoint.y,
        screenWidth: global.screen.width,
        screenHeight: global.screen.height,
        target: { x: spawnPoint.x, y: spawnPoint.y },
        name: global.playerName,
        type: type,
        hue: Math.random() * 360,
        cells: [{
            x: spawnPoint.x,
            y: spawnPoint.y,
            mass: window.config.defaultPlayerMass,
            radius: window.util.massToRadius(window.config.defaultPlayerMass)
        }]
    };
    global.player = window.player;

    if (!global.networkCoordinator) {
        global.networkCoordinator = new NetworkCoordinator();
    }

    // Initialize game state
    window.chat.registerFunctions();
    setupGameNetwork();

    // Start host election
    global.networkCoordinator.broadcastMessage('PLAYER_JOIN', {
        userId: window.pulgram.getUserId(),
        playerData: {
            name: global.playerName,
            type: type,
            screenWidth: global.screen.width,
            screenHeight: global.screen.height
        }
    });

    global.networkCoordinator.startHostElection();

    if (!global.animLoopHandle) {
        animloop();
    }
    
    global.gameStart = true;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectator');
    };

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

// Initialize canvas and input handling
var c = window.canvas.cv;
var graph = c.getContext('2d');

// Add throttling for movement messages
let lastBroadcastTime = 0;
const BROADCAST_INTERVAL = 100; // Limit to 10 messages per second

// Handle mouse movement on canvas
c.addEventListener('mousemove', function(evt) {
    const rect = c.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    
    // Update local target immediately for smooth animation
    window.target.x = x;
    window.target.y = y;
    window.canvas.target = { x, y };

    // Throttle broadcast messages
    const now = Date.now();
    if (global.networkCoordinator && now - lastBroadcastTime >= BROADCAST_INTERVAL) {
        global.networkCoordinator.broadcastMessage('PLAYER_ACTION', {
            userId: window.pulgram.getUserId(),
            action: 'move',
            params: { x, y }
        });
        lastBroadcastTime = now;
    }
});

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

$("#feed").click(function () {
    if (global.networkCoordinator) {
        global.networkCoordinator.broadcastMessage('PLAYER_ACTION', {
            userId: window.pulgram.getUserId(),
            action: 'eject',
            params: {}
        });
    }
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    if (global.networkCoordinator) {
        global.networkCoordinator.broadcastMessage('PLAYER_ACTION', {
            userId: window.pulgram.getUserId(),
            action: 'split',
            params: {}
        });
    }
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    if (!global.kicked) {
        render.drawErrorMessage('Disconnected from host!', graph, global.screen);
        // Try to re-elect a new host
        if (global.networkCoordinator) {
            global.networkCoordinator.startHostElection();
        }
    }
}

// Replace socket stuff with P2P networking
function setupGameNetwork() {
    if (!global.networkCoordinator) return;

    // Update game state when received from host
    const coordinator = global.networkCoordinator;
      coordinator.onGameStateUpdate = (state) => {
        if (coordinator.isHost) return; // Host maintains own state
        
        console.log('Received game state update:', state);
        
        // Update game state from host
        if (state.playerData) {
            window.player = state.playerData;
            if (!window.player.cells) {
                window.player.cells = [{
                    x: window.player.x,
                    y: window.player.y,
                    mass: window.config.defaultPlayerMass,
                    radius: window.util.massToRadius(window.config.defaultPlayerMass),
                    hue: window.player.hue,
                    name: window.player.name
                }];
            }
        }
        window.foods = Array.isArray(state.foods) ? state.foods : [];
        window.viruses = Array.isArray(state.viruses) ? state.viruses : [];
        window.users = Array.isArray(state.users) ? state.users : [];
        window.fireFood = Array.isArray(state.massList) ? state.massList : [];
        window.leaderboard = Array.isArray(state.leaderboard) ? state.leaderboard : [];

        // Update global game size
        if (state.gameSize) {
            global.gameWidth = state.gameSize.width;
            global.gameHeight = state.gameSize.height;
        }
        
        global.gameStart = true;
    };

    coordinator.onPlayerDeath = (data) => {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        // Rest of death handling...
    };

    coordinator.onPlayerKick = (data) => {
        global.gameStart = false;
        global.kicked = true;
        if (data.reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + data.reason, graph, global.screen);
        } else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
    };
}

const isUnnamedCell = (name) => name.length < 1;

// Convert game coordinates to screen coordinates
function getPosition(obj, player, screen) {
    if (!obj || !player || !screen) return { x: 0, y: 0 };
    
    // Calculate camera offset based on player position
    let dx = obj.x - player.x;
    let dy = obj.y - player.y;
    
    // Transform to screen space
    let x = screen.width / 2 + dx;
    let y = screen.height / 2 + dy;
    
    return {
        x: Math.round(x),
        y: Math.round(y)
    };
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    if (window.animLoopHandle) {
        window.cancelAnimationFrame(window.animLoopHandle);
    }
    window.animLoopHandle = window.requestAnimFrame(gameLoop);
}

function gameLoop() {
    if (!global.gameStart) return;

    // Clear the canvas
    graph.fillStyle = global.backgroundColor || '#F2FBFF';
    graph.fillRect(0, 0, global.screen.width, global.screen.height);

    try {
        // Update game size from config if not set
        if (!global.gameWidth) global.gameWidth = window.config.gameWidth;
        if (!global.gameHeight) global.gameHeight = window.config.gameHeight;

        const borders = {
            top: 0,
            left: 0,
            right: global.gameWidth,
            bottom: global.gameHeight
        };

        // Draw the grid first
        if (global.player) {
            render.drawGrid(global, global.player, global.screen, graph);
        }

        // Draw border if enabled
        if (window.showBorders) {
            render.drawBorder(borders, graph);
        }

        // Draw foods
        if (Array.isArray(window.foods)) {
            window.foods.forEach(food => {
                if (!food) return;
                const position = getPosition(food, global.player, global.screen);
                render.drawFood(position, food, graph);
            });
        }

        // Draw viruses
        if (Array.isArray(window.viruses)) {
            window.viruses.forEach(virus => {
                if (!virus) return;
                const position = getPosition(virus, global.player, global.screen);
                render.drawVirus(position, virus, graph);
            });
        }

        // Draw fire food
        if (Array.isArray(window.fireFood)) {
            window.fireFood.forEach(massFood => {
                if (!massFood) return;
                const position = getPosition(massFood, global.player, global.screen);
                render.drawFireFood(position, massFood, playerConfig, graph);
            });
        }

        // Draw current player
        if (global.player && global.player.cells) {
            const playerCells = global.player.cells.map(cell => {
                const position = getPosition(cell, global.player, global.screen);
                return {
                    ...cell,
                    x: position.x,
                    y: position.y,
                    hue: global.player.hue,
                    name: global.player.name
                };
            });
            render.drawCells(playerCells, playerConfig, window.toggleMassState, borders, graph);
        }

        // Draw other players
        if (Array.isArray(window.users)) {
            window.users.forEach(user => {
                if (!user || !user.cells) return;
                const userCells = user.cells.map(cell => {
                    const position = getPosition(cell, global.player, global.screen);
                    return {
                        ...cell,
                        x: position.x,
                        y: position.y,
                        hue: user.hue,
                        name: user.name
                    };
                });
                render.drawCells(userCells, playerConfig, window.toggleMassState, borders, graph);
            });
        }

    } catch (err) {
        console.error('Error in game loop:', err);
    }

    // Continue animation
    window.animLoopHandle = window.requestAnimFrame(gameLoop);
}

window.addEventListener('resize', resize);

function resize() {
    if (!global.networkCoordinator) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    if (global.networkCoordinator) {
        global.networkCoordinator.broadcastMessage('PLAYER_ACTION', {
            userId: window.pulgram.getUserId(),
            action: 'resize',
            params: { 
                screenWidth: global.screen.width, 
                screenHeight: global.screen.height 
            }
        });
    }
}

// Mobile controls
var isTouching = false;
var touchStartPos = { x: 0, y: 0 };
var touchCurrentPos = { x: 0, y: 0 };
var mobileGamepad = document.getElementById('mobile');
var maxJoystickDistance = 50; // Maximum distance the joystick can move

function handleTouchStart(evt) {
    isTouching = true;
    const touch = evt.touches[0];
    touchStartPos.x = touch.clientX;
    touchStartPos.y = touch.clientY;
    touchCurrentPos.x = touch.clientX;
    touchCurrentPos.y = touch.clientY;
}

function handleTouchMove(evt) {
    if (!isTouching) return;
    evt.preventDefault();
    
    const touch = evt.touches[0];
    touchCurrentPos.x = touch.clientX;
    touchCurrentPos.y = touch.clientY;
    
    // Calculate joystick displacement
    const dx = touchCurrentPos.x - touchStartPos.x;
    const dy = touchCurrentPos.y - touchStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize to max joystick distance
    const scale = distance > maxJoystickDistance ? maxJoystickDistance / distance : 1;
    const scaledDx = dx * scale;
    const scaledDy = dy * scale;
    
    // Update target based on joystick position
    const centerX = global.screen.width / 2;
    const centerY = global.screen.height / 2;
    window.target.x = centerX + scaledDx * 10; // Scale movement for better control
    window.target.y = centerY + scaledDy * 10;
    window.canvas.target = { x: window.target.x, y: window.target.y };

    // Update visual position of gamepad
    const gamepad = document.getElementById('mobile');
    if (gamepad) {
        gamepad.style.transform = `translate(${scaledDx}px, ${scaledDy}px)`;
    }

    // Throttle broadcast messages
    const now = Date.now();
    if (global.networkCoordinator && now - lastBroadcastTime >= BROADCAST_INTERVAL) {
        global.networkCoordinator.broadcastMessage('PLAYER_ACTION', {
            userId: window.pulgram.getUserId(),
            action: 'move',
            params: { x: window.target.x, y: window.target.y }
        });
        lastBroadcastTime = now;
    }
}

function handleTouchEnd(evt) {
    isTouching = false;
    // Reset gamepad position
    const gamepad = document.getElementById('mobile');
    if (gamepad) {
        gamepad.style.transform = 'translate(0px, 0px)';
    }
}

if (global.mobile) {
    mobileGamepad.addEventListener('touchstart', handleTouchStart);
    mobileGamepad.addEventListener('touchmove', handleTouchMove);
    mobileGamepad.addEventListener('touchend', handleTouchEnd);
    mobileGamepad.addEventListener('touchcancel', handleTouchEnd);
}
