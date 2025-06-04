 
 const SAT = window.SAT ;
import gameLogic from './game-logic.js';
import config from '../config.js';
import util from './lib/util.js'; 
import PulgramSocket from '../js/pulgram-socket.js';

import { getPosition } from './lib/entityUtils.js';
 
import mapUtils from './map/map.js';
let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

const Vector = SAT.Vector;

let playerLists = {};
// Add player to playerLists
function addPlayerToList(playerId, playerData) {
    if (!playerId) {
        console.error('[ERROR] Attempted to add player with invalid ID');
        return false;
    }
    
    // Store player data with ID as key
    playerLists[playerId] = playerData || {
        id: playerId,
        lastSeen: Date.now(),
        connected: true
    };
    
    console.log(`[INFO] Player ${playerId} added to player list`);
    console.log(`[INFO] Total players in list: ${Object.keys(playerLists).length}`);
    return true;
}

// Remove player from playerLists
function removePlayerFromList(playerId) {
    if (!playerId || !playerLists[playerId]) {
        console.warn(`[WARN] Attempted to remove non-existent player: ${playerId}`);
        return false;
    }
    
    // Delete the player entry
    delete playerLists[playerId];
    
    console.log(`[INFO] Player ${playerId} removed from player list`);
    console.log(`[INFO] Total players in list: ${Object.keys(playerLists).length}`);
    return true;
}

// Update player data in playerLists
function updatePlayerInList(playerId, updates) {
    if (!playerId || !playerLists[playerId]) {
        console.warn(`[WARN] Attempted to update non-existent player: ${playerId}`);
        return false;
    }
    
    // Update with new data
    playerLists[playerId] = {
        ...playerLists[playerId],
        ...updates,
        lastUpdated: Date.now()
    };
    
    return true;
}

// Get player from list
function getPlayerFromList(playerId) {
    return playerLists[playerId];
}

// Check if player is in list
function isPlayerInList(playerId) {
    return !!playerLists[playerId];
}

let gameIntervals = {
  tickGame: null,
  gameloop: null,
  sendUpdates: null
};

function startHostLogic(socket){
    console.log('Starting host logic...');
    socket.on('connection', (data) => {
        console.log('User has connected: ', data.type);
        switch (data.type) {
            case 'player':
                console.log('Adding player with ID: ', data.playerId);
                addPlayerToList(data.playerId,new mapUtils.playerUtils.Player(data.playerId));
                break;
            default:
                console.log('Unknown user type, not doing anything.');
        }
    });

    socket.on('gotit', function (clientPlayerData) {
        // Make sure we have the player ID from the message
        var currentPlayer = getPlayerFromList(clientPlayerData.id);
        const playerId =  clientPlayerData.id;
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(playerId) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.broadcast('kick', { playerId: playerId, reason: 'Already connected' });
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.broadcast('kick', { playerId: playerId, reason: 'Invalid username' });
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');

            const sanitizedName = clientPlayerData.name.replace(/(<([^>]+)>)/ig, '');
            clientPlayerData.name = sanitizedName;

            currentPlayer.clientProvidedData(clientPlayerData);
            updatePlayerInList(playerId, currentPlayer);
            map.players.pushNew(currentPlayer);
            
            console.log('Total players: ' + map.players.data.length);
        }
    });

    // Update the respawn handler to work with player IDs
    socket.on('respawn', (data) => {
        const playerId =  data.playerId;
        if (!playerId) return;
      
        const currentPlayer = getPlayerFromList(playerId);
        
        map.players.removePlayerByID(playerId);
        // Send welcome message to the specific player
        socket.emit('welcome', {
            player: currentPlayer,
            width: config.gameWidth,
            height: config.gameHeight,
            to: playerId // Target specific player
        });
        
 
        console.log('[INFO] User with ID ' + playerId + ' has respawned');
    });

    socket.on('pingcheck', () => {
        socket.broadcast('pongcheck');
    });

    socket.on('windowResized', (data) => {

        const playerId =    data.playerId;
        const target =      data.target 
        var currentPlayer = getPlayerFromList(playerId);
 
 
        currentPlayer.screenWidth = target.screenWidth;
        currentPlayer.screenHeight = target.screenHeight;
        updatePlayerInList(playerId, currentPlayer);
    });
 



    socket.on('0', (data) => {
        // Extract player ID from the message to identify which player sent it
        const playerId =    data.playerId;
        const target =      data.target 
        
        // Find the player by ID
        const playerIndex = map.players.findIndexByID(playerId);
        if (playerIndex === -1) {
            console.warn('[WARN] Player with ID ' + playerId + ' not found for heartbeat update.');
            return; // Player not found
        }
        
        const currentPlayer = map.players.data[playerIndex];
        currentPlayer.lastHeartbeat = new Date().getTime();
        
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function (data) {
        // Fire food.
        const playerId = data.playerId;
        const playerIndex = map.players.findIndexByID(playerId);
        if (playerIndex === -1) return; // Player not found
        
        const currentPlayer = map.players.data[playerIndex];
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', (data) => {
        const playerId =  data.playerId;
        const playerIndex = map.players.findIndexByID(playerId);
        if (playerIndex === -1) return; // Player not found
        
        const currentPlayer = map.players.data[playerIndex];
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
    // Start all intervals and store their IDs

    gameIntervals.gameloop = setInterval(gameloop, 1000);
    gameIntervals.tickGame = setInterval(() => tickGame(socket), 1000 / 120);
    gameIntervals.sendUpdates = setInterval(() => sendUpdates(socket), 1000 / config.networkUpdateFactor);
}
function stopHostLogic(socket) {
  socket.off('connection');
  
  // Clear all intervals
  clearInterval(gameIntervals.tickGame);
  clearInterval(gameIntervals.gameloop);
  clearInterval(gameIntervals.sendUpdates);
  
  // Reset interval IDs
  gameIntervals.tickGame = null;
  gameIntervals.gameloop = null;
  gameIntervals.sendUpdates = null;
}
function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}


const addPlayer = (socket,playerId) => {



}

 

const tickPlayer = (socket,currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        socket.broadcast('kick', { playerId : currentPlayer.id , reason : 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.'});
        map.players.removePlayerByID(currentPlayer.id);
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    const isEntityInsideCircle = (point, circle) => {
        return SAT.pointInCircle(new Vector(point.x, point.y), circle);
    };

    const canEatMass = (cell, cellCircle, cellIndex, mass) => {
        if (isEntityInsideCircle(mass, cellCircle)) {
            if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num)
                return false;
            if (cell.mass > mass.mass * 1.1)
                return true;
        }

        return false;
    };

    const canEatVirus = (cell, cellCircle, virus) => {
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];

        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
};

const tickGame = (socket) => {
    map.players.data.forEach(player => tickPlayer(socket, player));
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            let playerGotEaten = map.players.data[gotEaten.playerIndex];
            //io.emit('playerDied', { name: playerGotEaten.name }); //TODO: on client it is `playerEatenName` instead of `name`
            socket.broadcast('RIP',playerGotEaten.id);
            map.players.removePlayerByIndex(gotEaten.playerIndex);
        }
    });

};

const calculateLeaderboard = () => {
    const topPlayers = map.players.getTopPlayers();

    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    } else {
        for (let i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].id !== topPlayers[i].id) {
                leaderboard = topPlayers;
                leaderboardChanged = true;
                break;
            }
        }
    }
}

const gameloop = () => {
    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }

    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
};

const sendUpdates = (socket) => {
    // Create a combined data structure to hold all player data
    let allPlayerData = {};
    let allVisiblePlayers = {};
    let allVisibleFood = {};
    let allVisibleMass = {};
    let allVisibleViruses = {};
    

    map.enumerateWhatPlayersSee(function(playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        // Store this player's view in our combined data structure
        const playerId = playerData.id;
        allPlayerData[playerId] = playerData;
        allVisiblePlayers[playerId] = visiblePlayers;
        allVisibleFood[playerId] = visibleFood;
        allVisibleMass[playerId] = visibleMass;
        allVisibleViruses[playerId] = visibleViruses;
    });

    
    // Send a single combined update to all players
    socket.emit('serverTellPlayerMove', {
        pd: allPlayerData,
        vp: allVisiblePlayers,
        vf: allVisibleFood,
        vm: allVisibleMass,
        vv: allVisibleViruses
    });
    
    // Send leaderboard if it changed
    if (leaderboardChanged) {
        sendLeaderboard(socket);
    }
    
    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}
 

export default{
    startHostLogic,
    stopHostLogic,
};