import { useMemo } from "react";
import * as THREE from "three";

// Plate texture is drawn on an offscreen 2D canvas (system fonts only) rather
// than fetched — keeps the 3D scene fully local/offline like the rest of the app.
export function usePlateTexture(plate) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f4ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0b0f16";
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.fillStyle = "#0b0f16";
    ctx.font = "bold 72px Consolas, 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(plate || "— — — — —", canvas.width / 2, canvas.height / 2 + 6);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [plate]);
}
