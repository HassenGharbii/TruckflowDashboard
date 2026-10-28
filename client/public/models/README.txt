Drop a truck model here named exactly:

    camion.glb

It will be picked up automatically on the next page refresh (no code changes,
no rebuild needed in dev mode). If it fails to load or isn't found, the app
falls back to the built-in procedural truck.

After adding a real model, open client/src/truckModelConfig.js and adjust:
  - rotationY        if the truck faces the wrong way
  - plate.position   so the plate sits flush against the rear
  - plate.rotation   so the plate faces outward instead of into the model

The model is auto-scaled/centered to a consistent size regardless of its
original units, so you generally only need to tweak the plate placement.
