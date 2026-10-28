import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { usePlateTexture } from "../usePlateTexture";
import GlbTruck from "./GlbTruck";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

function Wheel({ x, z }) {
  return (
    <group position={[x, 0.4, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.38, 0.38, 0.24, 24]} />
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.13]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 20]} />
        <meshStandardMaterial color="#9aa3b2" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function TruckModel({ plate, cabColor }) {
  const plateTexture = usePlateTexture(plate);

  return (
    <group position={[0, -0.4, 0]}>
      {/* chassis */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[3.6, 0.12, 1.3]} />
        <meshStandardMaterial color="#20242e" roughness={0.8} />
      </mesh>

      {/* cab */}
      <mesh position={[1.35, 0.95, 0]} castShadow>
        <boxGeometry args={[0.95, 0.9, 1.25]} />
        <meshStandardMaterial color={cabColor} metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[1.7, 1.08, 0]}>
        <boxGeometry args={[0.1, 0.42, 1.05]} />
        <meshStandardMaterial color="#0a0d13" metalness={0.6} roughness={0.15} />
      </mesh>

      {/* cargo box */}
      <mesh position={[-0.55, 1.05, 0]} castShadow>
        <boxGeometry args={[2.1, 1.3, 1.3]} />
        <meshStandardMaterial color="#e9e9e4" roughness={0.75} />
      </mesh>
      {/* cargo box panel lines */}
      {[-1.3, -0.55, 0.2].map((x) => (
        <mesh key={x} position={[x, 1.05, 0.651]}>
          <boxGeometry args={[0.02, 1.26, 0.01]} />
          <meshStandardMaterial color="#c9c9c2" />
        </mesh>
      ))}

      {/* license plate, mounted on the rear of the cargo box */}
      <mesh position={[-1.63, 0.56, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.62, 0.18]} />
        <meshBasicMaterial map={plateTexture} toneMapped={false} />
      </mesh>

      {/* wheels: one axle under the cab, two under the cargo box */}
      {[1.2, -0.3, -0.95].map((x) => (
        <group key={x}>
          <Wheel x={x} z={0.72} />
          <Wheel x={x} z={-0.72} />
        </group>
      ))}
    </group>
  );
}

export default function Truck3D({ plate, sens }) {
  const cabColor = sens === "Sortie" ? "#38bdf8" : sens === "Entree" ? "#34d399" : "#64748b";
  const rimColor = sens === "Sortie" ? "#38bdf8" : sens === "Entree" ? "#34d399" : "#6366f1";

  return (
    <div className="truck3d-wrap">
      <Canvas camera={{ position: [4.3, 2.3, 4.7], fov: 30 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} />
        <pointLight position={[-3, 2.2, -3]} intensity={1.6} color={rimColor} />
        <ModelErrorBoundary fallback={<TruckModel plate={plate} cabColor={cabColor} />}>
          <Suspense fallback={<TruckModel plate={plate} cabColor={cabColor} />}>
            <GlbTruck plate={plate} />
          </Suspense>
        </ModelErrorBoundary>
        <ContactShadows position={[0, -0.01, 0]} opacity={0.55} scale={8} blur={2.4} far={2} />
        <OrbitControls
          autoRotate
          autoRotateSpeed={1.3}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </div>
  );
}
