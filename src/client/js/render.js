(function() {
    const FULL_ANGLE = 2 * Math.PI;

    const drawRoundObject = (position, radius, graph) => {
        if (!position || typeof radius !== 'number') {
            console.warn('Invalid drawRoundObject params:', {position, radius});
            return;
        }
        graph.beginPath();
        graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
        graph.closePath();
        graph.fill();
        graph.stroke();
    };

    const drawFood = (position, food, graph) => {
        if (!food || typeof food.hue !== 'number') {
            console.warn('Invalid food:', food);
            return;
        }
        graph.fillStyle = `hsl(${food.hue}, 100%, 50%)`;
        graph.strokeStyle = `hsl(${food.hue}, 100%, 45%)`;
        graph.lineWidth = 1;
        drawRoundObject(position, food.radius, graph);
    };

    const drawVirus = (position, virus, graph) => {
        graph.strokeStyle = virus.stroke;
        graph.fillStyle = virus.fill;
        graph.lineWidth = virus.strokeWidth;
        let theta = 0;
        let sides = 20;

        graph.beginPath();
        for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
            let point = circlePoint(position, virus.radius, theta);
            graph.lineTo(point.x, point.y);
        }
        graph.closePath();
        graph.stroke();
        graph.fill();
    };

    const drawFireFood = (position, mass, playerConfig, graph) => {
        graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
        graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
        graph.lineWidth = playerConfig.border + 2;
        drawRoundObject(position, mass.radius - 1, graph);
    };

    const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

    const circlePoint = (origo, radius, theta) => ({
        x: origo.x + radius * Math.cos(theta),
        y: origo.y + radius * Math.sin(theta)
    });

    const cellTouchingBorders = (cell, borders) =>
        cell.x - cell.radius <= borders.left ||
        cell.x + cell.radius >= borders.right ||
        cell.y - cell.radius <= borders.top ||
        cell.y + cell.radius >= borders.bottom

    const regulatePoint = (point, borders) => ({
        x: valueInRange(borders.left, borders.right, point.x),
        y: valueInRange(borders.top, borders.bottom, point.y)
    });

    const drawCellWithLines = (cell, borders, graph) => {
        let pointCount = 30 + ~~(cell.mass / 5);
        let points = [];
        for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
            let point = circlePoint(cell, cell.radius, theta);
            points.push(regulatePoint(point, borders));
        }
        graph.beginPath();
        graph.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graph.lineTo(points[i].x, points[i].y);
        }
        graph.closePath();
        graph.fill();
        graph.stroke();
    }    
    const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
        if (!Array.isArray(cells)) {
            console.warn('Invalid cells:', cells);
            return;
        }
        
        // Make sure playerConfig is defined
        playerConfig = playerConfig || {
            border: 6,
            textColor: '#FFFFFF',
            textBorder: '#000000',
            textBorderSize: 3
        };
        
        // Make sure borders are defined
        borders = borders || {
            left: 0,
            right: window.config?.gameWidth || 5000,
            top: 0,
            bottom: window.config?.gameHeight || 5000
        };
        
        for (let cell of cells) {
            if (!cell) {
                console.warn('Invalid cell:', cell);
                continue;
            }

            // Ensure cell has all required properties
            const x = Number(cell.x);
            const y = Number(cell.y);
            const radius = Number(cell.radius || (cell.mass ? window.util.massToRadius(cell.mass) : 10));
            
            if (isNaN(x) || isNaN(y) || isNaN(radius) || radius <= 0) {
                console.warn('Cell has invalid coordinates or radius:', cell);
                continue;
            }

            // Set cell position for drawing
            cell.x = x;
            cell.y = y;
            cell.radius = radius;

            // Draw the cell itself
            graph.fillStyle = cell.color || `hsl(${cell.hue || 0}, 100%, 50%)`;
            graph.strokeStyle = cell.borderColor || `hsl(${cell.hue || 0}, 100%, 45%)`;
            graph.lineWidth = playerConfig.border || 6;

            if (cellTouchingBorders(cell, borders)) {
                drawCellWithLines(cell, borders, graph);
            } else {
                drawRoundObject(cell, cell.radius, graph);
            }

            // Draw the name of the player if it exists
            if (cell.name) {
                let fontSize = Math.max(cell.radius / 3, 12);
                graph.lineWidth = playerConfig.textBorderSize;
                graph.fillStyle = playerConfig.textColor;
                graph.strokeStyle = playerConfig.textBorder;
                graph.miterLimit = 1;
                graph.lineJoin = 'round';
                graph.textAlign = 'center';
                graph.textBaseline = 'middle';
                graph.font = 'bold ' + fontSize + 'px sans-serif';
                graph.strokeText(cell.name, cell.x, cell.y);
                graph.fillText(cell.name, cell.x, cell.y);

                // Draw the mass if enabled
                if (toggleMassState === 1) {
                    graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
                    graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
                    graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
                }
            }
        }
    };

    const drawGrid = (global, player, screen, graph) => {
        if (!player || !screen) {
            console.warn('Invalid grid params:', {player, screen});
            return;
        }
        graph.lineWidth = 1;
        graph.strokeStyle = global.lineColor;
        graph.globalAlpha = 0.15;
        graph.beginPath();

        for (let x = -player.x; x < screen.width; x += screen.height / 18) {
            graph.moveTo(x, 0);
            graph.lineTo(x, screen.height);
        }

        for (let y = -player.y; y < screen.height; y += screen.height / 18) {
            graph.moveTo(0, y);
            graph.lineTo(screen.width, y);
        }

        graph.stroke();
        graph.globalAlpha = 1;
    };

    const drawBorder = (borders, graph) => {
        graph.lineWidth = 1;
        graph.strokeStyle = '#000000'
        graph.beginPath()
        graph.moveTo(borders.left, borders.top);
        graph.lineTo(borders.right, borders.top);
        graph.lineTo(borders.right, borders.bottom);
        graph.lineTo(borders.left, borders.bottom);
        graph.closePath()
        graph.stroke();
    };

    const drawErrorMessage = (message, graph, screen) => {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screen.width, screen.height);
        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText(message, screen.width / 2, screen.height / 2);
    }

    // Export to window object    
    const clearScreen = (graph, screen) => {
        graph.fillStyle = window.global.backgroundColor;
        graph.fillRect(0, 0, screen.width, screen.height);
    };

    window.render = {
        drawRoundObject,
        drawFood,
        drawVirus,
        drawFireFood,
        drawCells,
        drawErrorMessage,
        drawGrid,
        drawBorder,
        clearScreen
    };
})();