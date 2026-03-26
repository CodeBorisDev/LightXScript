ScriptAPI.registerScript({
  name: "Scaffold",
  version: "3.0",
  author: "LightX",
});

var mod = ScriptAPI.registerModule({
  name: "Scaffold",
  description: "Places blocks beneath you while walking",
  category: "MOVEMENT",
});

var rotateMode = mod.addMode(
  "Rotation",
  "How rotations are handled",
  "Silent",
  "Silent",
  "None",
);
var sprintOpt = mod.addBool(
  "Sprint",
  "Keep sprinting while scaffolding",
  false,
);
var safeWalk = mod.addBool(
  "Safe Walk",
  "Sneak at edges to prevent falling",
  true,
);
var swingOpt = mod.addBool("Swing", "Play arm swing animation", true);
var delayOpt = mod.addSlider("Delay", "Ticks between placements", 0, 0, 5, 1);
var expandOpt = mod.addSlider(
  "Expand",
  "How many blocks ahead to extend",
  0,
  0,
  3,
  1,
);

var BlockHitResult = JavaType.mc("world.phys.BlockHitResult");
var Vec3 = JavaType.mc("world.phys.Vec3");

var DIR_DOWN = JavaType.getStatic("net.minecraft.core.Direction", "DOWN");
var DIR_UP = JavaType.getStatic("net.minecraft.core.Direction", "UP");
var DIR_NORTH = JavaType.getStatic("net.minecraft.core.Direction", "NORTH");
var DIR_SOUTH = JavaType.getStatic("net.minecraft.core.Direction", "SOUTH");
var DIR_WEST = JavaType.getStatic("net.minecraft.core.Direction", "WEST");
var DIR_EAST = JavaType.getStatic("net.minecraft.core.Direction", "EAST");
var MAIN_HAND = JavaType.getStatic(
  "net.minecraft.world.InteractionHand",
  "MAIN_HAND",
);

var tickCounter = 0;
var originalSlot = -1;

mod.on("enable", function () {
  tickCounter = 0;
  if (mc.player) {
    originalSlot = mc.player.getInventory().getSelectedSlot();
  }
});

mod.on("disable", function () {
  if (mc.player) {
    mc.player.setShiftKeyDown(false);
    if (originalSlot >= 0 && originalSlot <= 8) {
      ItemUtil.switchToSlot(originalSlot);
    }
  }
  originalSlot = -1;
});

mod.on("GameTickEvent", function () {
  if (!mc.player || !mc.level || !mc.gameMode) return;

  var player = mc.player;

  if (safeWalk.getValue()) {
    var belowFeet = BlockUtil.newBlockPos(
      Primitives.toInt(Math.floor(player.getX())),
      Primitives.toInt(Math.floor(player.getY()) - 1),
      Primitives.toInt(Math.floor(player.getZ())),
    );
    if (BlockUtil.isAir(belowFeet)) {
      player.setShiftKeyDown(true);
    } else {
      player.setShiftKeyDown(false);
    }
  }

  if (!sprintOpt.getValue()) {
    player.setSprinting(false);
  }

  tickCounter++;
  var requiredDelay = Primitives.toInt(delayOpt.getValue());
  if (requiredDelay > 0 && tickCounter < requiredDelay) return;

  var placement = findPlacement();
  if (!placement) return;

  var blockSlot = findBlockInHotbar();
  if (blockSlot < 0) return;

  var currentSlot = player.getInventory().getSelectedSlot();
  if (blockSlot !== currentSlot) {
    ItemUtil.switchToSlot(blockSlot);
  }

  if (rotateMode.getValue() === "Silent") {
    var rot = RotationUtil.newRotationBlock(placement.pos);
    if (rot) {
      var clampedPitch = Math.max(60, Math.min(86, rot.pitch));
      NetworkUtil.movePlayerPositionAndLook(
        player.getX(),
        player.getY(),
        player.getZ(),
        Primitives.toFloat(rot.yaw),
        Primitives.toFloat(clampedPitch),
        player.onGround(),
        false,
      );
    }
  }

  var hitVec = new Vec3(
    placement.pos.getX() + 0.5 + placement.face.getStepX() * 0.5,
    placement.pos.getY() + 0.5 + placement.face.getStepY() * 0.5,
    placement.pos.getZ() + 0.5 + placement.face.getStepZ() * 0.5,
  );

  var hitResult = new BlockHitResult(
    hitVec,
    placement.face,
    placement.pos,
    false,
  );
  var hand = MAIN_HAND;

  var result = mc.gameMode.useItemOn(player, hand, hitResult);
  if (result.consumesAction()) {
    tickCounter = 0;
    if (swingOpt.getValue()) {
      player.swing(hand);
    }
  }

  if (rotateMode.getValue() === "Silent") {
    NetworkUtil.movePlayerPositionAndLook(
      player.getX(),
      player.getY(),
      player.getZ(),
      player.getYRot(),
      player.getXRot(),
      player.onGround(),
      false,
    );
  }

  if (blockSlot !== currentSlot) {
    ItemUtil.switchToSlot(currentSlot);
  }
});

function findPlacement() {
  var player = mc.player;
  var expand = Primitives.toInt(expandOpt.getValue());

  var yaw = (player.getYRot() * Math.PI) / 180.0;
  var dx = -Math.sin(yaw);
  var dz = Math.cos(yaw);

  for (var e = 0; e <= expand; e++) {
    var bx = Primitives.toInt(Math.floor(player.getX() + dx * e));
    var by = Primitives.toInt(Math.floor(player.getY()) - 1);
    var bz = Primitives.toInt(Math.floor(player.getZ() + dz * e));

    var targetPos = BlockUtil.newBlockPos(bx, by, bz);

    if (!isAirOrReplaceable(targetPos)) continue;

    var result = findSupportFace(targetPos);
    if (result) return result;
  }

  return null;
}

function findSupportFace(targetPos) {
  var directions = [DIR_DOWN, DIR_UP, DIR_NORTH, DIR_SOUTH, DIR_WEST, DIR_EAST];

  for (var i = 0; i < directions.length; i++) {
    var face = directions[i];
    var neighborPos = targetPos.relative(face);

    if (isAirOrReplaceable(neighborPos)) continue;

    return {
      pos: neighborPos,
      face: face.getOpposite(),
    };
  }

  return null;
}

function isAirOrReplaceable(pos) {
  if (!mc.level) return true;
  var state = mc.level.getBlockState(pos);
  if (state.isAir()) return true;
  if (state.canBeReplaced()) return true;
  return false;
}

function findBlockInHotbar() {
  if (!mc.player) return -1;

  var inv = mc.player.getInventory();
  var current = inv.getSelectedSlot();

  if (isUsableBlock(inv.getItem(current))) return current;

  for (var i = 0; i <= 8; i++) {
    if (i === current) continue;
    if (isUsableBlock(inv.getItem(i))) return i;
  }

  return -1;
}

function isUsableBlock(stack) {
  if (!stack || stack.isEmpty()) return false;

  var id = ItemUtil.getItemId(stack).toLowerCase();

  if (id.indexOf("air") !== -1) return false;

  var reject = [
    "water",
    "lava",
    "grass",
    "fern",
    "flower",
    "poppy",
    "dandelion",
    "orchid",
    "allium",
    "tulip",
    "daisy",
    "cornflower",
    "lily",
    "mushroom",
    "torch",
    "sign",
    "banner",
    "bed",
    "door",
    "trapdoor",
    "leaves",
    "sand",
    "gravel",
    "snow",
    "rail",
    "vine",
    "ladder",
    "chest",
    "barrel",
    "furnace",
    "crafting",
    "anvil",
    "glass_pane",
    "iron_bars",
    "fence",
    "wall",
    "slab",
    "stair",
    "button",
    "plate",
    "lever",
    "tripwire",
    "web",
    "sugar_cane",
    "cactus",
    "bamboo",
    "sapling",
    "seeds",
    "wheat",
    "potato",
    "carrot",
    "beetroot",
    "melon",
    "pumpkin_stem",
    "kelp",
    "seagrass",
    "lantern",
    "candle",
    "campfire",
    "scaffolding",
    "redstone",
    "repeater",
    "comparator",
    "hopper",
    "dispenser",
    "dropper",
    "piston",
    "observer",
    "tnt",
    "spawner",
    "enchanting",
    "brewing",
    "cauldron",
    "bell",
    "head",
    "skull",
  ];

  for (var r = 0; r < reject.length; r++) {
    if (id.indexOf(reject[r]) !== -1) return false;
  }

  var name = stack.getItem().toString().toLowerCase();
  if (
    name.indexOf("block") !== -1 ||
    name.indexOf("planks") !== -1 ||
    name.indexOf("stone") !== -1 ||
    name.indexOf("dirt") !== -1 ||
    name.indexOf("wood") !== -1 ||
    name.indexOf("log") !== -1 ||
    name.indexOf("concrete") !== -1 ||
    name.indexOf("terracotta") !== -1 ||
    name.indexOf("brick") !== -1 ||
    name.indexOf("wool") !== -1 ||
    name.indexOf("obsidian") !== -1 ||
    name.indexOf("netherrack") !== -1 ||
    name.indexOf("end_stone") !== -1 ||
    name.indexOf("sandstone") !== -1 ||
    name.indexOf("deepslate") !== -1 ||
    name.indexOf("copper") !== -1 ||
    name.indexOf("quartz") !== -1 ||
    name.indexOf("basalt") !== -1 ||
    name.indexOf("calcite") !== -1 ||
    name.indexOf("dripstone") !== -1 ||
    name.indexOf("tuff") !== -1 ||
    name.indexOf("prismarine") !== -1 ||
    name.indexOf("purpur") !== -1 ||
    name.indexOf("blackstone") !== -1
  ) {
    return true;
  }

  try {
    var block = mc.level.getBlockState(BlockPos.ZERO).getBlock();
    var itemBlock = stack.getItem().getClass();
    var blockItemClass = JavaType.mc("world.item.BlockItem");
    if (blockItemClass && blockItemClass.isAssignableFrom(itemBlock)) {
      return true;
    }
  } catch (e) {}

  return false;
}
