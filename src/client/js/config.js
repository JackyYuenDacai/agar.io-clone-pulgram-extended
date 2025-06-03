// Game configuration parameters
window.config = {    host: "0.0.0.0",
    port: 3000,
    logpath: "logger.php",
    foodMass: 1,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
    // FireFood configuration
    fireFood: {
        border: 3,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 2,
        defaultSize: 20,
        defaultMass: 20
    },
    // Cell configurations
    player: {
        border: 6,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 3,
        defaultSize: 30
    },
    food: {
        border: 2,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 2,
        defaultSize: 10
    },
    virus: {
        border: 3,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 2,
        defaultSize: 20,
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
    },
    gameWidth: 5000,
    gameHeight: 5000,
    adminPass: "DEFAULT",
    gameMass: 20000,
    maxFood: 1000,
    maxVirus: 50,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 1,
    minMassLoss: 50,    
    sqlinfo: {
      fileName: "db.sqlite3",
    },
    users: {
        border: 6,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 3,
        defaultSize: 30
    },
    fireFood: {
        border: 4,
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 2,
        defaultSize: 15
    }
};
