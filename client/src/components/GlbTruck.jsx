import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { usePlateTexture } from "../usePlateTexture";
import { GLB_MODEL_URL, TRUCK_CONFIG } from "../truckModelConfig";

export default function GlbTruck({ plate }) {
  const { scene } = useGLTF(GLB_MODEL_URL);
  const plateTexture = usePlateTexture(plate);

  const normalized = useMemo(() => {
    const clone = scene.clone(true);

    // Auto-fit: scale to a consistent height, then sit it on the ground
    // centered on X/Z — works regardless of the source model's own units.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scaleFactor = size.y > 0 ? TRUCK_CONFIG.targetHeight / size.y : 1;
    clone.scale.setScalar(scaleFactor);
    clone.rotation.y = TRUCK_CONFIG.rotationY;
    clone.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box2.min.y;

    return clone;
  }, [scene]);

  return (
    <group position={[0, -0.4, 0]}>
      <primitive object={normalized} />
      <mesh position={TRUCK_CONFIG.plate.position} rotation={TRUCK_CONFIG.plate.rotation}>
        <planeGeometry args={TRUCK_CONFIG.plate.size} />
        <meshBasicMaterial map={plateTexture} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}
