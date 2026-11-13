import { useWorkspace } from "../state/workspace";
import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshLambertMaterial,
  MeshBasicMaterial,
  PerspectiveCamera,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useEditor } from "../state/store";
import { createWallGeometry } from "../core/mesh";
import { bounds } from "../core/geometry";
import { FT } from "../core/units";

/** Genuine 3D projection and orbit for machines without WebGL. */
export function SoftwareModel({
  orthographic = false,
}: {
  orthographic?: boolean;
}) {
  const ws = useWorkspace();
  const host = useRef<HTMLDivElement>(null),
    project = useEditor((s) => s.project),
    selected = useEditor((s) => s.selected),
    fitToken = useEditor((s) => s.fitToken);
  const rendererRef = useRef<{ scene: Scene; draw: () => void } | null>(null);
  useEffect(() => {
    const el = host.current!;
    const scene = new Scene();
    scene.background = new Color("#d8dde3");
    const renderer = new SVGRenderer();
    renderer.setQuality("high");
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "3D room rendered from shared wall geometry",
    );
    el.appendChild(renderer.domElement);
    const camera = orthographic
        ? new OrthographicCamera(-30, 30, 30, -30, 0.1, 10000)
        : new PerspectiveCamera(42, 1, 0.1, 10000),
      b = bounds(project),
      center = new Vector3(
        (b.maxX + b.minX) / 2 / FT,
        0,
        (b.maxY + b.minY) / 2 / FT,
      ),
      size = Math.max((b.maxX - b.minX) / FT, (b.maxY - b.minY) / FT, 12),
      height = Math.max(
        ...project.floor.walls
          .filter(() => ws.layers.walls.visible)
          .map((w) => w.height / FT),
        9,
      ),
      span = Math.max(size, height);
    center.y = height * 0.35;
    camera.position.set(
      center.x + span * 1.4,
      span * 1.5,
      center.z + span * 1.6,
    );
    camera.lookAt(center);
    const controls = new OrbitControls(camera, el);
    controls.target.copy(center);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2;
    controls.maxDistance = 5000;
    controls.update();
    scene.add(new AmbientLight("#fffdf3", 0.65));
    const light = new DirectionalLight("#fff8e5", 0.6);
    light.position.set(center.x - 10, 40, center.z + 25);
    scene.add(light);
    const objects: Mesh[] = [];
    for (const wall of project.floor.walls.filter(
      () => ws.layers.walls.visible,
    )) {
      const mesh = new Mesh(
        createWallGeometry(project, wall),
        new MeshLambertMaterial({ color: "#ffffff", vertexColors: true }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = project.floor.elevation / FT;
      mesh.userData.wallId = wall.id;
      objects.push(mesh);
      scene.add(mesh);
    }
    const floor = new Mesh(
      new PlaneGeometry(span * 5, span * 5),
      new MeshBasicMaterial({ color: "#c6cdd4" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, -0.03, center.z);
    floor.renderOrder = -2;
    scene.add(floor);
    const grid = new GridHelper(
      span * 3,
      Math.ceil(span * 3),
      "#8295a5",
      "#a3b1bd",
    );
    grid.position.set(center.x, -0.01, center.z);
    grid.renderOrder = -1;
    scene.add(grid);
    const draw = () => renderer.render(scene, camera);
    rendererRef.current = { scene, draw };
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      if (camera instanceof PerspectiveCamera)
        camera.aspect = w / Math.max(h, 1);
      else {
        camera.left = (-span * w) / Math.max(h, 1);
        camera.right = (span * w) / Math.max(h, 1);
        camera.top = span;
        camera.bottom = -span;
      }
      camera.updateProjectionMatrix();
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    controls.addEventListener("change", draw);
    resize();
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = el.getBoundingClientRect(),
        pointer = new Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        ray = new Raycaster();
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(objects)[0];
      useEditor
        .getState()
        .set({ selected: hit ? (hit.object.userData.wallId as string) : null });
    };
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointerup", pointerUp);
    return () => {
      observer.disconnect();
      controls.dispose();
      el.removeEventListener("pointerdown", pointerDown);
      el.removeEventListener("pointerup", pointerUp);
      objects.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as MeshLambertMaterial).dispose();
      });
      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      if (Array.isArray(grid.material))
        grid.material.forEach((m) => m.dispose());
      else grid.material.dispose();
      el.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, [project, fitToken, orthographic, ws.layers.walls.visible]);
  useEffect(() => {
    const context = rendererRef.current;
    if (!context) return;
    for (const wall of project.floor.walls.filter(
      () => ws.layers.walls.visible,
    )) {
      const mesh = context.scene.children.find(
        (o) => o.userData.wallId === wall.id,
      ) as Mesh | undefined;
      if (mesh)
        (mesh.material as MeshLambertMaterial).color.set(
          wall.id === selected ? "#c4dcf0" : "#ffffff",
        );
    }
    context.draw();
  }, [selected, project, fitToken]);
  return (
    <div className="software-model" ref={host} data-testid="software-model">
      <span className="renderer-note">
        Compatibility renderer · software 3D
      </span>
    </div>
  );
}
