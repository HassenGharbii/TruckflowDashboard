// Drop a .glb file at client/public/models/camion.glb and it will be picked up
// automatically (falls back to the built-in procedural truck if the file is
// missing).
//
// Current model: "Tata Signa Cargo Truck | Low Poly Game Ready PBR" by
// kevin_k_5124 (Sketchfab, CC-BY-4.0). Its raw bounding box is Y-up, ~2.47 x
// 3.74 x 15.27 units (W x H x L), facing +Z (cabin at +Z, rear at -Z), with
// a dedicated flat rear panel node ("truck_body_back_palne_0") at chassis/
// bumper height — that's what the plate position below is anchored to.
// If you swap in a different model, recompute these (see the bounding-box
// probe script used to derive them) rather than guessing.

export const GLB_MODEL_URL = "/models/camion.glb";

export const TRUCK_CONFIG = {
  // The model is auto-scaled so its bounding-box height equals this many
  // world units, and auto-centered so it sits on the ground at y = 0.
  targetHeight: 1.6,

  // Rotate the whole model around Y (radians) if it isn't facing the way
  // you expect once loaded (e.g. Math.PI to spin it 180°).
  rotationY: 0,

  // Where the license plate plane is placed/sized, in the SAME local space
  // as the model after auto-scaling/centering. Anchored to the chassis rear
  // panel's center (bumper height), pushed slightly past the rear bounding
  // edge (z ≈ -3.26) so it doesn't z-fight with the body mesh.
  plate: {
    position: [0, 0.31, -3.3],
    rotation: [0, Math.PI, 0],
    size: [0.46, 0.14],
  },
};
