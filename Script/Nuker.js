// Script: Nuker
// Description: Breaks blocks and draws a 3D box using LightX RenderAPI

console.log("=== Loading Nuker Module ===");

const nuker = module.register("Nuker", "Breaks blocks around you", "WORLD");

const range = nuker.addNumber("Range", 4.0, 1.0, 6.0, false);
const delay = nuker.addNumber("Delay", 0, 0, 10, true);
const renderEsp = nuker.addBoolean("Render ESP", true);

let currentTarget = null;
let tickTimer = 0;

function getDistance(x1, y1, z1, x2, y2, z2) {
    let dx = x1 - x2;
    let dy = y1 - y2;
    let dz = z1 - z2;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

nuker.onUpdate(function() {
    if (!player.exists()) return;

    if (tickTimer > 0) {
        tickTimer--;
        return;
    }

    let r = range.get();
    let pX = player.getX();
    let pY = player.getY();
    let pZ = player.getZ();
    
    let foundBlock = null;
    let minDst = 999.0;

    let rInt = Math.ceil(r);
    for (let x = -rInt; x <= rInt; x++) {
        for (let y = -rInt; y <= rInt; y++) {
            for (let z = -rInt; z <= rInt; z++) {
                let tX = Math.floor(pX + x);
                let tY = Math.floor(pY + y);
                let tZ = Math.floor(pZ + z);
                
                let dist = getDistance(pX, pY, pZ, tX, tY, tZ);
                if (dist > r) continue;

                // For simplicity we just target everything that isn't air
                // In a real script, you'd add block ID checks here
                let targetObj = {x: tX, y: tY, z: tZ};
                
                if (dist < minDst) {
                    minDst = dist;
                    foundBlock = targetObj;
                }
            }
        }
    }

    currentTarget = foundBlock;

    if (currentTarget != null) {
        // Break Block
        packet.sendDigging("START_DESTROY_BLOCK", currentTarget, "UP");
        packet.sendDigging("STOP_DESTROY_BLOCK", currentTarget, "UP");
        tickTimer = delay.get();
    }
});

nuker.onRender3D(function(event) {
    if (!player.exists() || currentTarget == null || !renderEsp.get()) return;

    // Green box with full alpha (0xFF00FF00)
    // Usage: drawBlockBox(blockPosObject, colorARGB)
    render.drawBlockBox(currentTarget, 0xFF00FF00);
});

nuker.onDisable(function() {
    currentTarget = null;
});
