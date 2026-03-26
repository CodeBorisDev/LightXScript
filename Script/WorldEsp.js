ScriptAPI.registerScript({
  name: "WorldESP_Test",
  version: "1.0",
  author: "LightX",
});

const mod = ScriptAPI.registerModule({
  name: "WorldESP_Test",
  description: "ESP with 3D, 2D",
  category: "VISUAL",
});

const mode = mod.addMode(
  "Mode",
  "Rendering mode",
  "3D",
  "3D",
  "2D",
  "Outline",
  "Grow",
);

const showPlayers = mod.addBool("Players", "Track players", true);
const showMobs = mod.addBool("Mobs", "Track hostile mobs", true);
const showAnimals = mod.addBool("Animals", "Track passive animals", false);

const playerColor = mod.addColor(
  "Player Color",
  "Player highlight",
  0xff0099ff | 0,
);
const mobColor = mod.addColor("Mob Color", "Mob highlight", 0xffff3333 | 0);
const animalColor = mod.addColor(
  "Animal Color",
  "Animal highlight",
  0xffffcc00 | 0,
);

const faceAlpha = mod.addSlider(
  "Face Alpha",
  "Face fill opacity (3D / Grow)",
  40,
  0,
  255,
  1,
);
const growSpeed = mod.addSlider(
  "Grow Speed",
  "Pulse cycles per second",
  1.5,
  0.2,
  5.0,
  0.1,
);
const growAmount = mod.addSlider(
  "Grow Amount",
  "Max pulse expansion in blocks",
  0.06,
  0.01,
  0.3,
  0.01,
);

const tracers = mod.addBool("Tracers", "Tracer lines to targets", false);
const floorRing = mod.addBool(
  "Floor Ring",
  "Circle on ground under entity",
  false,
);
const showNames = mod.addBool("Names", "Show entity name above box", true);
const showHP = mod.addBool("Health", "Show health bar below name", true);
const range = mod.addSlider("Range", "Detection range (blocks)", 60, 5, 200, 5);

let projectedBoxes = [];
let labels = [];

function withFaceAlpha(color) {
  return WorldRenderUtil.argb(
    Math.round(faceAlpha.getValue()),
    WorldRenderUtil.getRed(color),
    WorldRenderUtil.getGreen(color),
    WorldRenderUtil.getBlue(color),
  );
}

function getTargets() {
  const targets = [];
  const r = range.getValue();

  if (showPlayers.getValue()) {
    for (const e of EntityUtil.getNearbyPlayers(r))
      targets.push({ entity: e, color: playerColor.getColor() });
  }
  if (showMobs.getValue()) {
    for (const e of EntityUtil.getNearbyMobs(r))
      targets.push({ entity: e, color: mobColor.getColor() });
  }
  if (showAnimals.getValue()) {
    for (const e of EntityUtil.getNearbyAnimals(r))
      targets.push({ entity: e, color: animalColor.getColor() });
  }
  return targets;
}

function projectBox(entity) {
  const box = entity.getBoundingBox();
  const corners = [
    WorldRenderUtil.toScreen(box.minX, box.minY, box.minZ),
    WorldRenderUtil.toScreen(box.maxX, box.minY, box.minZ),
    WorldRenderUtil.toScreen(box.minX, box.minY, box.maxZ),
    WorldRenderUtil.toScreen(box.maxX, box.minY, box.maxZ),
    WorldRenderUtil.toScreen(box.minX, box.maxY, box.minZ),
    WorldRenderUtil.toScreen(box.maxX, box.maxY, box.minZ),
    WorldRenderUtil.toScreen(box.minX, box.maxY, box.maxZ),
    WorldRenderUtil.toScreen(box.maxX, box.maxY, box.maxZ),
  ].filter((c) => c !== null);

  if (corners.length < 2) return null;

  let x1 = corners[0][0],
    y1 = corners[0][1];
  let x2 = x1,
    y2 = y1;
  for (const c of corners) {
    if (c[0] < x1) x1 = c[0];
    if (c[1] < y1) y1 = c[1];
    if (c[0] > x2) x2 = c[0];
    if (c[1] > y2) y2 = c[1];
  }
  return { x1, y1, x2, y2 };
}

function buildLabel(entity, color) {
  const box = entity.getBoundingBox();

  const top = WorldRenderUtil.toScreen(
    entity.getX(),
    box.maxY + 0.15,
    entity.getZ(),
  );
  if (top === null) return null;

  const name = EntityUtil.getName(entity);
  const hp = EntityUtil.getHealth(entity);
  const maxHp = EntityUtil.getMaxHealth(entity);
  const hpFrac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  return {
    screenX: top[0],
    screenY: top[1],
    name,
    hp,
    maxHp,
    hpFrac,
    color,
  };
}

function healthColor(frac) {
  if (frac >= 0.5) {
    const t = (frac - 0.5) * 2;
    const r = Math.round(255 * (1 - t));
    return WorldRenderUtil.argb(255, r, 255, 0);
  } else {
    const t = frac * 2;
    const g = Math.round(255 * t);
    return WorldRenderUtil.argb(255, 255, g, 0);
  }
}

mod.on("WorldRenderEvent", (e) => {
  const targets = getTargets();
  projectedBoxes = [];
  labels = [];

  if (targets.length === 0) return;

  const currentMode = mode.getValue();
  const now = Date.now() / 1000.0;

  if (showNames.getValue() || showHP.getValue()) {
    for (const { entity, color } of targets) {
      const lbl = buildLabel(entity, color);
      if (lbl !== null) labels.push(lbl);
    }
  }

  if (currentMode === "2D") {
    for (const { entity, color } of targets) {
      const rect = projectBox(entity);
      if (rect !== null) projectedBoxes.push({ rect, color });
    }
    return;
  }

  WorldRenderUtil.renderBatched(e, (env) => {
    for (const { entity, color } of targets) {
      const outline = color;
      const face = withFaceAlpha(color);
      const box = entity.getBoundingBox();

      if (currentMode === "3D") {
        env.drawEntityBox(entity, face, outline);
      } else if (currentMode === "Outline") {
        env.drawEntityOutline(entity, outline);
      } else if (currentMode === "Grow") {
        const phase = entity.getId() * 0.37;
        const g =
          Math.sin((now * growSpeed.getValue() + phase) * Math.PI * 2) *
          growAmount.getValue();
        const pulseOutline = WorldRenderUtil.pulse(
          outline,
          WorldRenderUtil.withAlpha(outline, 120),
          growSpeed.getValue(),
          phase,
        );

        env.drawBox(
          box.minX - g,
          box.minY - g,
          box.minZ - g,
          box.maxX + g,
          box.maxY + g,
          box.maxZ + g,
          face,
          pulseOutline,
        );
      }

      if (tracers.getValue())
        env.drawTracer(entity, WorldRenderUtil.withAlpha(outline, 160));

      if (floorRing.getValue())
        env.drawEntityCircle(
          entity,
          0.65,
          WorldRenderUtil.withAlpha(outline, 130),
        );
    }
  });
});

mod.on("RenderHudEvent", (e) => {
  const gg = e.guiGraphics;
  const font = FontUtil.outfit();
  const currentMode = mode.getValue();
  const lineH = font.getHeight();

  if (currentMode === "2D") {
    for (const { rect, color } of projectedBoxes) {
      const w = rect.x2 - rect.x1;
      const h = rect.y2 - rect.y1;
      if (w < 2 || h < 2) continue;

      RenderUtil.drawRoundedRect(
        gg,
        rect.x1,
        rect.y1,
        w,
        h,
        0,
        WorldRenderUtil.withAlpha(color, 25),
      );
      RenderUtil.drawRoundedBorder(gg, rect.x1, rect.y1, w, h, 0, 1, color);
    }
  }

  const drawN = showNames.getValue();
  const drawHP = showHP.getValue();
  if (!drawN && !drawHP) return;
  if (labels.length === 0) return;

  const BAR_W = 40;
  const BAR_H = 3;
  const PAD = 2;

  for (const lbl of labels) {
    const { screenX, screenY, name, hp, maxHp, hpFrac, color } = lbl;

    // Total block height so we can stack name then bar neatly above the box.
    const blockH = (drawN ? lineH : 0) + (drawHP ? BAR_H + PAD : 0);

    let curY = screenY - blockH - 1;

    if (drawN) {
      font.drawCentered(gg, name, screenX, curY, color, true);
      curY += lineH;
    }

    if (drawHP) {
      curY += PAD;

      const barX = screenX - BAR_W / 2;
      const fillW = Math.max(1, Math.round(BAR_W * hpFrac));
      const hpCol = healthColor(hpFrac);

      // Dark background
      RenderUtil.drawRoundedRect(
        gg,
        barX,
        curY,
        BAR_W,
        BAR_H,
        1,
        0xaa000000 | 0,
      );

      // Coloured fill
      RenderUtil.drawRoundedRect(gg, barX, curY, fillW, BAR_H, 1, hpCol);

      // HP numbers to the right of the bar
      const hpText = Math.ceil(hp) + "";
      font.drawText(gg, hpText, barX + BAR_W + 2, curY - 1, hpCol, true);
    }
  }
});
