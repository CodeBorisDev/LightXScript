// Script: ModuleStrafe
// Description: Strafe into different directions while you're midair or on ground.
console.log("=== Loading Strafe Module ===");

const strafeModule = module.register("Strafe", "Strafe in air and on ground", "MOVEMENT");

const strengthInAir = strafeModule.addNumber("Air Strength", 1.0, 0.1, 5.0, false);
const strengthOnGround = strafeModule.addNumber("Ground Strength", 1.0, 0.1, 5.0, false);

const strictMovement = strafeModule.addBoolean("Strict Movement", false);

function getDirection() {
    let rotationYaw = player.getYaw();
    let forward = player.getForward();
    let strafe = player.getStrafe();

    if (forward < 0) rotationYaw += 180;

    let forwardFactor = 1;
    if (forward < 0) forwardFactor = -0.5;
    else if (forward > 0) forwardFactor = 0.5;

    if (strafe > 0) rotationYaw -= 90 * forwardFactor;
    if (strafe < 0) rotationYaw += 90 * forwardFactor;

    return rotationYaw * (Math.PI / 180);
}

strafeModule.onUpdate(function() {
    if (!player.exists()) return;

    let airStr = strengthInAir.get();
    let groundStr = strengthOnGround.get();
    let isStrict = strictMovement.get();

    let strength = player.isOnGround() ? groundStr : airStr;
    
    if (strength <= 0.0) return;

    if (player.isMoving()) {
        let dir = getDirection();
        

        let vx = -Math.sin(dir) * strength;
        let vz = Math.cos(dir) * strength;
        
        player.setVelocity(vx, player.getVelocityY(), vz);
        
    } else if (isStrict) {
        player.setVelocity(0, player.getVelocityY(), 0);
    }
});

strafeModule.onRender2D(function(event) {
    if (!player.exists()) return;
    
    let mode = player.isOnGround() ? "Ground" : "Air";
    let val = player.isOnGround() ? strengthOnGround.get() : strengthInAir.get();
    
    render.drawText("Strafe: " + mode + " §7(" + val.toFixed(2) + ")", 5, 200, 0xFFFFFF);
});
