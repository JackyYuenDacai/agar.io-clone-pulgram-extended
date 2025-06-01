// Client-side utility functions
window.util = {
    massToRadius: function(mass) {
        return 4 + Math.sqrt(mass) * 6;
    },

    mathLog: (function() {
        var log = Math.log;
        return function(n, base) {
            return log(n) / (base ? log(base) : 1);
        };
    })(),

    getDistance: function(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
    },

    randomInRange: function(from, to) {
        return Math.floor(Math.random() * (to - from)) + from;
    },

    randomPosition: function(radius) {
        return {
            x: this.randomInRange(radius, window.config.gameWidth - radius),
            y: this.randomInRange(radius, window.config.gameHeight - radius)
        };
    }
};
