import { map } from "./maps/sample.js";

const mapWidth = map[0].length;
const mapHeight = map.length;

// Constants
const kPlayerStart = 20;
const kTable = 11;

// Configuration
const miniMapScale = 4;
const stripWidth = 2;
const viewportWidth = 1280;
const viewportHeight = 720;
const playerRotationSpeed = (2 * Math.PI) / 180;
const playerMoveSpeed = 0.1;

// Calculated
const fov = (60 * Math.PI) / 180;
const numRays = Math.ceil(viewportWidth / stripWidth);
const viewDist = viewportWidth / 2 / Math.tan(fov / 2);

// Runtime
let displayMiniMap = true;
let renderTexture = false;
let rightPressed = false;
let leftPressed = false;
let upPressed = false;
let downPressed = false;

// Prepare Canvas
const canvas = document.getElementById("canvas");
canvas.width = viewportWidth;
canvas.height = viewportHeight;
const ctx = canvas.getContext("2d");

let player = {
  x: 0,
  y: 0,
  dir: 0,
  rot: 0,
  speed: 0,
};

let fpsInterval, startTime, now, then, elapsed;

// Spawn the player at position
for (var y = 0; y < mapHeight; y++) {
  for (var x = 0; x < mapWidth; x++) {
    if (map[y][x] == kPlayerStart) {
      player.x = x;
      player.y = y;
    }
  }
}

// Mainloop
const draw = () => {
  requestAnimationFrame(draw);
  now = Date.now();
  elapsed = now - then;
  if (elapsed > fpsInterval) {
    then = now - (elapsed % fpsInterval);

    handleKeyboardInput();
    renderEnvironment();
    movePlayer();
    castRays();
    drawMiniMap();
  }
};

const handleKeyboardInput = () => {
  player.dir = rightPressed ? 1 : leftPressed ? -1 : 0;
  player.speed = upPressed ? 1 : downPressed ? -1 : 0;
};

const movePlayer = () => {
  var moveStep = player.speed * playerMoveSpeed;

  player.rot += player.dir * playerRotationSpeed;

  var newX = player.x + Math.cos(player.rot) * moveStep;
  var newY = player.y + Math.sin(player.rot) * moveStep;

  if (isBlocking(newX, newY)) {
    return;
  }

  player.x = newX;
  player.y = newY;
};

const isBlocking = (x, y) => {
  if (y < 0 || y >= mapHeight || x < 0 || x >= mapWidth) {
    return true;
  }
  return map[Math.floor(y)][Math.floor(x)] != 0;
};

const drawMiniMap = () => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  for (var y = 0; y < mapHeight; y++) {
    for (var x = 0; x < mapWidth; x++) {
      var wall = map[y][x];
      if (wall > 0 && wall < 10) {
        ctx.fillRect(
          x * miniMapScale + 20,
          y * miniMapScale + 20,
          miniMapScale,
          miniMapScale
        );
      }
    }
  }
};

const renderEnvironment = () => {
  // Ceiling
  ctx.fillStyle = "#99ccff";
  ctx.fillRect(0, -canvas.height / 2, canvas.width, canvas.height);

  // Floor
  ctx.fillStyle = "#009900";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height);
};

const castRays = () => {
  var stripIdx = 0;
  for (var i = 0; i < numRays; i++) {
    var rayScreenPos = (-numRays / 2 + i) * stripWidth;
    var rayViewDist = Math.sqrt(
      rayScreenPos * rayScreenPos + viewDist * viewDist
    );
    var rayAngle = Math.asin(rayScreenPos / rayViewDist);

    castSingleRay(player.rot + rayAngle, stripIdx++);
  }
};

const castSingleRay = (rayAngle, stripIdx) => {
  rayAngle %= Math.PI * 2;
  if (rayAngle < 0) {
    rayAngle += Math.PI * 2;
  }

  const right = rayAngle > Math.PI * 2 * 0.75 || rayAngle < Math.PI * 2 * 0.25;
  const up = rayAngle < 0 || rayAngle > Math.PI;
  const angleSin = Math.sin(rayAngle);
  const angleCos = Math.cos(rayAngle);

  let collisions = [];

  let dist = 0;
  let xHit = 0;
  let yHit = 0;

  let textureX = 0;

  let slope = angleSin / angleCos;
  let dX = right ? 1 : -1;
  let dY = dX * slope;

  let x = right ? Math.ceil(player.x) : Math.floor(player.x);
  let y = player.y + (x - player.x) * slope;

  let wallCollision = null;

  while (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
    const wallX = Math.floor(x + (right ? 0 : -1));
    const wallY = Math.floor(y);

    if (map[wallY][wallX] > 0 && map[wallY][wallX] != kPlayerStart) {
      const distX = x - player.x;
      const distY = y - player.y;

      dist = distX * distX + distY * distY;

      textureX = y % 1;
      if (!right) {
        textureX = 1 - textureX;
      }

      const collision = {
        objIdx: map[wallY][wallX],
        stripIdx: stripIdx,
        rayAngle: rayAngle,
        dist: dist,
        textureX: textureX,
        dark: true,
      };

      if (map[wallY][wallX] < 10) {
        // Wall hit
        xHit = x;
        yHit = y;
        wallCollision = collision;
        break;
      } else {
        collisions.push(collision);
      }
    }

    x += dX;
    y += dY;
  }

  slope = angleCos / angleSin;
  dY = up ? -1 : 1;
  dX = dY * slope;
  y = up ? Math.floor(player.y) : Math.ceil(player.y);
  x = player.x + (y - player.y) * slope;

  while (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
    const wallY = Math.floor(y + (up ? -1 : 0));
    const wallX = Math.floor(x);

    if (map[wallY][wallX] > 0 && map[wallY][wallX] != kPlayerStart) {
      const distX = x - player.x;
      const distY = y - player.y;

      dist = distX * distX + distY * distY;

      textureX = x % 1;
      if (up) {
        textureX = 1 - textureX;
      }

      const collision = {
        objIdx: map[wallY][wallX],
        stripIdx: stripIdx,
        rayAngle: rayAngle,
        dist: dist,
        textureX: textureX,
        dark: true,
      };

      if (map[wallY][wallX] < 10) {
        // Wall hit (closer than current wall)
        if (wallCollision == null || wallCollision.dist > collision.dist) {
          wallCollision = collision;
          xHit = x;
          yHit = y;
        }
        break;
      } else {
        collisions.push(collision);
      }
    }
    x += dX;
    y += dY;
  }

  collisions = collisions.reverse();
  collisions.unshift(wallCollision);

  if (displayMiniMap) {
    drawRay(xHit, yHit);
  }

  collisions.forEach(function (item, index, array) {
    renderRayCollision(item);
  });
};

const renderRayCollision = (collision) => {
  const dist =
    Math.sqrt(collision.dist) * Math.cos(player.rot - collision.rayAngle);
  const tHeight = Math.round(viewDist / dist);
  const top = Math.round((canvas.height - tHeight) / 2);

  if (renderTexture) {
    drawSprite(
      collision.objIdx,
      collision.stripIdx * stripWidth,
      top,
      stripWidth * 2,
      tHeight,
      collision.textureX,
      stripWidth / orgSpriteWidth,
      collision.dark
    );
    noTint();
  } else {
    ctx.strokeStyle = "rgba(1, 1, 1, 0)";
    var grayScale = mapValue(dist, 0, 32, 255, 0);
    ctx.fillStyle = "rgba(" + grayScale + ", " + 0 + ", " + 0 + ", 1)";
    ctx.fillRect(collision.stripIdx * stripWidth, top, stripWidth, tHeight);
  }
};

const mapValue = (value, x1, y1, x2, y2) =>
  ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;

const drawRay = (targetX, targetY) => {
  ctx.beginPath();
  ctx.strokeStyle = "rgba(30, 30, 30, 0.2)";
  ctx.lineWidth = 0.1;
  ctx.moveTo(player.x * miniMapScale + 20, player.y * miniMapScale + 20);
  ctx.lineTo(targetX * miniMapScale + 20, targetY * miniMapScale + 20);
  ctx.stroke();
};

const keyDownHandler = (e) => {
  if (event.keyCode == 39) {
    rightPressed = true;
  } else if (event.keyCode == 37) {
    leftPressed = true;
  }
  if (event.keyCode == 40) {
    downPressed = true;
  } else if (event.keyCode == 38) {
    upPressed = true;
  }
};

const keyUpHandler = (e) => {
  if (event.keyCode == 39) {
    rightPressed = false;
  } else if (event.keyCode == 37) {
    leftPressed = false;
  }
  if (event.keyCode == 40) {
    downPressed = false;
  } else if (event.keyCode == 38) {
    upPressed = false;
  }
};

// Setup keyboard handling
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

function startAnimating(fps) {
  fpsInterval = 1000 / fps;
  then = Date.now();
  startTime = then;
  draw();
}
startAnimating(60);
