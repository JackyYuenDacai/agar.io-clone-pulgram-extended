// Get dependencies from window object
const render = window.render;
const ChatClient = window.ChatClient;
const Canvas = window.Canvas;
const global = window.global;

const playerNameInput = document.getElementById('playerNameInput');
let socket;

const debug = (args) => {
    console?.log?.(args);
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
        global.disconnected = true;
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
    const coordinator = global.networkCoordinator;        coordinator.onGameStateUpdate = (state) => {
        if (coordinator.isHost) return; // Host maintains own state
        
        console.log('Received game state update:', state);
        
        // Update game state from host
        try {
            // Update player data
            if (state.players && state.players[window.pulgram.getUserId()]) {
                const playerData = state.players[window.pulgram.getUserId()];
                window.player = {
                    id: playerData.id,
                    x: playerData.x,
                    y: playerData.y,
                    hue: playerData.hue || Math.round(Math.random() * 360),
                    name: playerData.name,
                    cells: Array.isArray(playerData.cells) ? playerData.cells.map(cell => ({
                        x: cell.x,
                        y: cell.y,
                        mass: cell.mass || window.config.defaultPlayerMass,
                        radius: cell.radius || window.util.massToRadius(cell.mass || window.config.defaultPlayerMass),
                        hue: cell.hue || playerData.hue,
                        name: playerData.name
                    })) : [{
                        x: playerData.x,
                        y: playerData.y,
                        mass: window.config.defaultPlayerMass,
                        radius: window.util.massToRadius(window.config.defaultPlayerMass),
                        hue: playerData.hue,
                        name: playerData.name
                    }]
                };
            }
            
            // Update game elements with proper properties
            window.foods = Array.isArray(state.food) ? state.food.map(food => ({
                x: food.x,
                y: food.y,
                radius: food.radius || window.util.massToRadius(food.mass || window.config.foodMass),
                mass: food.mass || window.config.foodMass,
                hue: food.hue || Math.round(Math.random() * 360)
            })) : [];
            
            window.viruses = Array.isArray(state.viruses) ? state.viruses.map(virus => ({
                x: virus.x,
                y: virus.y,
                mass: virus.mass || window.config.virus.defaultMass.from,
                radius: virus.radius || window.util.massToRadius(virus.mass || window.config.virus.defaultMass.from),
                fill: virus.fill || window.config.virus.fill,
                stroke: virus.stroke || window.config.virus.stroke,
                strokeWidth: virus.strokeWidth || window.config.virus.strokeWidth
            })) : [];
            
            window.fireFood = Array.isArray(state.massFood) ? state.massFood.map(mass => ({
                x: mass.x,
                y: mass.y,
                mass: mass.mass || window.config.fireFood.defaultMass,
                radius: mass.radius || window.util.massToRadius(mass.mass || window.config.fireFood.defaultMass),
                hue: mass.hue || Math.round(Math.random() * 360)
            })) : [];
            
            // Update users (other players)
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
                            hue: user.hue || Math.round(Math.random() * 360),
                            name: user.name
                        }],
                        hue: user.hue || Math.round(Math.random() * 360),
                        name: user.name
                    }));
            }            
            window.leaderboard = Array.isArray(state.leaderboard) ? state.leaderboard : [];
        } catch (err) {
            console.error('Error processing game state update:', err);
        }

        // Update global game size
        global.game = {
            width: state.gameWidth || window.config.gameWidth,
            height: state.gameHeight || window.config.gameHeight
        };
        
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
    // Debug information to help diagnose issues (limit to once per second to avoid console spam)
    if (!window.lastDebugTime || Date.now() - window.lastDebugTime > 1000) {
        console.log('Game Loop Iteration', {
            disconnected: global.disconnected,
            hasPlayer: !!window.player,
            playerCells: window.player?.cells?.length || 0,
            foodCount: window.foods?.length || 0,
            virusCount: window.viruses?.length || 0,
            userCount: window.users?.length || 0,
            screen: global.screen,
            game: global.game
        });
        window.lastDebugTime = Date.now();
    }
    
    // Ensure global screen dimensions are set correctly
    if (!global.screen.width || !global.screen.height) {
        global.screen = {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
    
    // Ensure global game dimensions are set correctly
    if (!global.game.width || !global.game.height) {
        global.game = {
            width: window.config.gameWidth || 5000,
            height: window.config.gameHeight || 5000
        };
    }
    
    if (global.disconnected) {
        render.drawErrorMessage('Disconnected from host!', graph, global.screen);
    } else if (window.player) {
        // Clear the screen
        render.clearScreen(graph, global.screen);
        
        // Draw game grid
        render.drawGrid(global, window.player, global.screen, graph);
        
        // Draw the border if enabled
        if (global.borderDraw) {
            render.drawBorder({
                left: 0,
                right: global.game.width,
                top: 0,
                bottom: global.game.height
            }, graph);
        }
          // Draw game elements
        const foodConfig = window.config.food;
        const virusConfig = window.config.virus;
        const fireFoodConfig = window.config.fireFood;
        const playerConfig = window.config.player;
        const userConfig = window.config.users;        // Define borders for drawing
        const borders = {
            left: 0,
            right: global.game.width,
            top: 0,
            bottom: global.game.height
        };
        
        // Draw each game element type
        if (window.foods && Array.isArray(window.foods)) {
            render.drawCells(window.foods.map(f => ({ ...f, type: 'food' })), foodConfig, global.toggleMassState, borders, graph);
        }
        if (window.viruses && Array.isArray(window.viruses)) {
            render.drawCells(window.viruses.map(v => ({ ...v, type: 'virus' })), virusConfig, global.toggleMassState, borders, graph);
        }
        if (window.fireFood && Array.isArray(window.fireFood)) {
            render.drawCells(window.fireFood.map(f => ({ ...f, type: 'fireFood' })), fireFoodConfig, global.toggleMassState, borders, graph);
        }
        if (window.users && Array.isArray(window.users)) {
            render.drawCells(window.users.map(u => ({ ...u, type: 'user' })), userConfig, global.toggleMassState, borders, graph);
        }
        if (window.player && window.player.cells && Array.isArray(window.player.cells)) {
            render.drawCells(window.player.cells.map(c => ({ ...c, type: 'player' })), playerConfig, global.toggleMassState, borders, graph);
        }    }
    
    // Use the animloop function instead of directly calling requestAnimationFrame
    window.animLoopHandle = window.requestAnimationFrame(gameLoop);
}

// Start animation loop
animloop();

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

const borders = {
    left: 0,
    right: window.config.gameWidth,
    top: 0,
    bottom: window.config.gameHeight
};
