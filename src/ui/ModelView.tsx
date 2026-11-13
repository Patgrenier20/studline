import { useWorkspace } from "../state/workspace";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useEditor } from "../state/store";
import { bounds } from "../core/geometry";
import { createWallGeometry } from "../core/mesh";
import { SoftwareModel } from "./SoftwareModel";
import { type Project, type Wall } from "../core/model";
import { FT } from "../core/units";
import { RotateCcw } from "lucide-react";
function CameraRig({
  project,
  fitToken,
  orthographic = false,
}: {
  project: Project;
  fitToken: number;
  orthographic?: boolean;
}) {
  const { camera, gl, invalidate } = useThree();
  const control = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.maxPolarAngle = Math.PI / 2 - 0.03;
    c.minDistance = 2;
    c.maxDistance = 5000;
    control.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useEffect(() => {
    const b = bounds(project),
      center = new Vector3(
        (b.maxX + b.minX) / 2 / FT,
        0,
        (b.maxY + b.minY) / 2 / FT,
      ),
      size = Math.max((b.maxX - b.minX) / FT, (b.maxY - b.minY) / FT, 12),
      height = Math.max(...project.floor.walls.map((w) => w.height / FT), 9),
      span = Math.max(size, height);
    center.y = height * 0.35;
    camera.position.set(
      center.x + span * 1.4,
      span * 1.5,
      center.z + span * 1.6,
    );
    camera.lookAt(center);
    if (orthographic) camera.zoom = 38 / Math.max(1, span / 24);
    (camera as PerspectiveCamera).far = Math.max(5000, span * 10);
    camera.updateProjectionMatrix();
    control.current?.target.copy(center);
    control.current?.update();
    invalidate();
    // Keep orbit stable during edits. Reset explicitly with fit or when opening a project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, fitToken, camera, invalidate, orthographic]);
  useFrame(() => control.current?.update());
  return null;
}
function WallMesh({ project, wall }: { project: Project; wall: Wall }) {
  const selected = useEditor((s) => s.selected),
    set = useEditor((s) => s.set);
  const geometry = useMemo(
    () => createWallGeometry(project, wall),
    [project, wall],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, project.floor.elevation / FT, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta < 4) set({ selected: wall.id });
      }}
    >
      <meshStandardMaterial
        vertexColors
        color={wall.id === selected ? "#c4dcf0" : "#ffffff"}
        roughness={0.85}
      />
    </mesh>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? <SoftwareModel /> : this.props.children;
  }
}
function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
export default function ModelView({
  orthographic = false,
}: {
  orthographic?: boolean;
}) {
  const ws = useWorkspace();
  const s = useEditor(),
    gpu = useMemo(hasWebGL, []),
    b = bounds(s.project),
    cx = (b.minX + b.maxX) / 2 / FT,
    cz = (b.minY + b.maxY) / 2 / FT,
    span = Math.max((b.maxX - b.minX) / FT, (b.maxY - b.minY) / FT, 25);
  return (
    <div className="model-view">
      <div className="canvas-heading">
        <span className="eyebrow">
          {orthographic ? "ORTHOGRAPHIC OVERVIEW" : "MODEL WORKSPACE"}
        </span>
        <h2>
          {s.project.floor.name}
          <span>3D</span>
        </h2>
      </div>
      <span className="live-model">
        <i /> LIVE MODEL · {s.project.floor.walls.length} WALLS
      </span>
      <SceneBoundary>
        {!gpu ? (
          <SoftwareModel orthographic={orthographic} />
        ) : (
          <Suspense
            fallback={<div className="scene-error">Loading 3D scene…</div>}
          >
            <Canvas
              key={orthographic ? "ortho" : "perspective"}
              orthographic={orthographic}
              shadows
              camera={{ fov: 42, near: 0.1, far: 5000 }}
              gl={{ antialias: true, preserveDrawingBuffer: true }}
              onPointerMissed={() => s.set({ selected: null })}
            >
              <color attach="background" args={["#d8dde3"]} />
              <ambientLight intensity={1.4} />
              <hemisphereLight args={["#fff9e8", "#b9c6bc", 1.5]} />
              <directionalLight
                position={[cx - 15, 45, cz + 25]}
                intensity={2.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-span * 1.5}
                shadow-camera-right={span * 1.5}
                shadow-camera-top={span * 1.5}
                shadow-camera-bottom={-span * 1.5}
                shadow-bias={-0.001}
              />
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[cx, -0.04, cz]}
                receiveShadow
              >
                <planeGeometry args={[span * 8, span * 8]} />
                <meshStandardMaterial color="#c6cdd4" roughness={1} />
              </mesh>
              <gridHelper
                args={[span * 4, Math.ceil(span * 4), "#c3cdc4", "#d0d7cf"]}
                position={[cx, -0.02, cz]}
              />
              {s.project.floor.walls
                .filter(() => ws.layers.walls.visible)
                .map((w) => (
                  <WallMesh key={w.id} project={s.project} wall={w} />
                ))}
              <CameraRig
                project={s.project}
                fitToken={s.fitToken}
                orthographic={orthographic}
              />
            </Canvas>
          </Suspense>
        )}
      </SceneBoundary>
      <div className="canvas-bottom">
        <span className="canvas-tip">
          Drag to orbit · Right-drag to pan · Scroll to zoom
        </span>
        <button
          className="light-button"
          onClick={() => s.set({ fitToken: s.fitToken + 1 })}
        >
          <RotateCcw size={14} /> Reset view
        </button>
      </div>
    </div>
  );
}
