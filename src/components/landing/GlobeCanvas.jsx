import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Monitored thermal hotspots matching telemetry
const HOTSPOTS = [
  { lat: 22.4707, lng: 70.0577, name: 'Jamnagar Flare Complex', primary: true, beamLength: 0.22 },
  { lat: 24.1200, lng: 82.6700, name: 'Singrauli Super Thermal', primary: false, beamLength: 0.19 },
  { lat: 28.6139, lng: 77.2090, name: 'NCR Thermal Cluster', primary: false, beamLength: 0.18 },
  { lat: 17.6868, lng: 83.2185, name: 'Vizag Industrial Zone', primary: false, beamLength: 0.16 },
  { lat: 19.0760, lng: 72.8777, name: 'Mumbai Industrial', primary: false, beamLength: 0.17 },
  { lat: 23.6693, lng: 86.1511, name: 'Bokaro Thermal Plant', primary: false, beamLength: 0.19 },
  { lat: 20.3164, lng: 86.6085, name: 'Paradip Petrochem', primary: false, beamLength: 0.16 },
];

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

export default function GlobeCanvas() {
  const containerRef = useRef(null);
  const [hasWebGL] = useState(() => isWebGLAvailable());

  useEffect(() => {
    if (!hasWebGL) return;
    const container = containerRef.current;
    if (!container) return;

    // Reduced motion query
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    const handleMotionChange = (e) => {
      prefersReducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const width = container.clientWidth || 520;
    const height = container.clientHeight || 520;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.4);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    container.appendChild(renderer.domElement);

    // Master 3D tilt group (Earth axial tilt ~23.5 degrees)
    const masterTiltGroup = new THREE.Group();
    masterTiltGroup.rotation.z = 23.5 * (Math.PI / 180);
    masterTiltGroup.rotation.x = 0.22;
    scene.add(masterTiltGroup);

    // Globe rotation group
    const globeGroup = new THREE.Group();
    masterTiltGroup.add(globeGroup);

    // 2. Base Sphere: Dark Navy Translucent Sphere with Flat Continent Silhouettes
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base dark ocean matching page tonal range
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;

    // Load vector equirectangular landmass SVG (Natural Earth 110m silhouettes)
    const landImg = new Image();
    landImg.onload = () => {
      ctx.drawImage(landImg, 0, 0, canvas.width, canvas.height);
      canvasTexture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    landImg.src = '/media/earth_vector_land.svg';

    const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      map: canvasTexture,
      transparent: true,
      opacity: 0.94,
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeGroup.add(sphereMesh);

    // 3. Fixed Silhouette Rim Outline Ring (Facing Camera)
    const rimPoints = [];
    for (let i = 0; i <= 128; i++) {
      const theta = (i / 128) * Math.PI * 2;
      rimPoints.push(new THREE.Vector3(Math.cos(theta) * 1.002, Math.sin(theta) * 1.002, 0));
    }
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPoints);
    const rimMat = new THREE.LineBasicMaterial({
      color: '#7ec8f2',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const rimLine = new THREE.Line(rimGeo, rimMat);
    scene.add(rimLine);

    // 4. 3D Wireframe Grid Lines (Latitude Parallels & Longitude Meridians)
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: '#7ec8f2',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });

    // Parallels (every 15 degrees)
    for (let lat = -75; lat <= 75; lat += 15) {
      const phi = (90 - lat) * (Math.PI / 180);
      const r = 1.003 * Math.sin(phi);
      const y = 1.003 * Math.cos(phi);
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Meridians (every 22.5 degrees)
    for (let lng = 0; lng < 360; lng += 22.5) {
      const theta = (lng * Math.PI) / 180;
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const lat = (i / segments) * Math.PI - Math.PI / 2;
        const y = 1.003 * Math.sin(lat);
        const r = 1.003 * Math.cos(lat);
        points.push(new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }
    globeGroup.add(gridGroup);

    // 5. Thermal Hotspots: Glowing Beacons, Translucent Outer Halos & Radiant Beams
    const hotspotsGroup = new THREE.Group();
    const pulseRings = [];

    HOTSPOTS.forEach((pt) => {
      const phi = (90 - pt.lat) * (Math.PI / 180);
      const theta = (pt.lng + 180) * (Math.PI / 180);

      const radius = 1.004;
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);

      const normal = new THREE.Vector3(x, y, z).normalize();

      // Glowing outer translucent halo disc on the surface
      const haloGeo = new THREE.RingGeometry(0, pt.primary ? 0.052 : 0.038, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: '#ff5a1f',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(x * 1.002, y * 1.002, z * 1.002);
      haloMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      hotspotsGroup.add(haloMesh);
      pulseRings.push(haloMesh);

      // Solid inner orange beacon dot
      const pointGeo = new THREE.SphereGeometry(pt.primary ? 0.022 : 0.016, 16, 16);
      const pointMat = new THREE.MeshBasicMaterial({ color: '#ff5a1f' });
      const pointMesh = new THREE.Mesh(pointGeo, pointMat);
      pointMesh.position.set(x, y, z);
      hotspotsGroup.add(pointMesh);

      // White-hot core
      const coreGeo = new THREE.SphereGeometry(pt.primary ? 0.010 : 0.007, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(x, y, z);
      hotspotsGroup.add(coreMesh);

      // Radiant outward directional spike beam (Strictly originates from base dot)
      const beamLength = pt.beamLength || 0.18;
      const endPos = new THREE.Vector3(
        x + normal.x * beamLength,
        y + normal.y * beamLength,
        z + normal.z * beamLength
      );

      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, z),
        endPos,
      ]);
      const beamMat = new THREE.LineBasicMaterial({
        color: '#ff5a1f',
        transparent: true,
        opacity: 0.95,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);
      hotspotsGroup.add(beamLine);

      // Tip node
      const tipGeo = new THREE.SphereGeometry(0.006, 8, 8);
      const tipMat = new THREE.MeshBasicMaterial({ color: '#ff5a1f' });
      const tipMesh = new THREE.Mesh(tipGeo, tipMat);
      tipMesh.position.copy(endPos);
      hotspotsGroup.add(tipMesh);

      // If primary hotspot (Jamnagar active anomaly), add dashed leader line pointing toward HUD card
      if (pt.primary) {
        // Dashed connector line with a cross-tick toward bottom-right HUD
        const targetPoint = new THREE.Vector3(
          x + normal.x * 0.28 + 0.15,
          y - 0.25,
          z + 0.1
        );
        const leaderCurve = [
          new THREE.Vector3(x, y, z),
          targetPoint,
        ];
        const leaderGeo = new THREE.BufferGeometry().setFromPoints(leaderCurve);
        const leaderMat = new THREE.LineDashedMaterial({
          color: '#ff5a1f',
          dashSize: 0.03,
          gapSize: 0.025,
          transparent: true,
          opacity: 0.55,
        });
        const leaderLine = new THREE.Line(leaderGeo, leaderMat);
        leaderLine.computeLineDistances();
        hotspotsGroup.add(leaderLine);

        // Small cross-tick on the dashed leader line
        const midPoint = new THREE.Vector3().lerpVectors(new THREE.Vector3(x, y, z), targetPoint, 0.45);
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(midPoint.x - 0.025, midPoint.y + 0.035, midPoint.z),
          new THREE.Vector3(midPoint.x + 0.025, midPoint.y - 0.035, midPoint.z),
        ]);
        const tickMat = new THREE.LineBasicMaterial({
          color: '#ff5a1f',
          transparent: true,
          opacity: 0.65,
        });
        const tickLine = new THREE.Line(tickGeo, tickMat);
        hotspotsGroup.add(tickLine);
      }
    });

    globeGroup.add(hotspotsGroup);

    // 6. Wireframe Satellite Icon along Dashed Elliptical LEO Orbit
    const satelliteGroup = new THREE.Group();

    // Central avionics chassis: wireframe box
    const satChassisEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.024, 0.024, 0.036));
    const satLineMat = new THREE.LineBasicMaterial({
      color: '#cbd5e1',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const satChassis = new THREE.LineSegments(satChassisEdges, satLineMat);
    satelliteGroup.add(satChassis);

    // Left and right solar array panel frames with center divider grid
    const panelPoints = [
      // Left solar wing
      new THREE.Vector3(-0.012, 0, -0.014), new THREE.Vector3(-0.056, 0, -0.014),
      new THREE.Vector3(-0.056, 0, -0.014), new THREE.Vector3(-0.056, 0, 0.014),
      new THREE.Vector3(-0.056, 0, 0.014), new THREE.Vector3(-0.012, 0, 0.014),
      new THREE.Vector3(-0.034, 0, -0.014), new THREE.Vector3(-0.034, 0, 0.014), // divider line
      // Right solar wing
      new THREE.Vector3(0.012, 0, -0.014), new THREE.Vector3(0.056, 0, -0.014),
      new THREE.Vector3(0.056, 0, -0.014), new THREE.Vector3(0.056, 0, 0.014),
      new THREE.Vector3(0.056, 0, 0.014), new THREE.Vector3(0.012, 0, 0.014),
      new THREE.Vector3(0.034, 0, -0.014), new THREE.Vector3(0.034, 0, 0.014), // divider line
    ];
    const panelGeo = new THREE.BufferGeometry().setFromPoints(panelPoints);
    const panelLines = new THREE.LineSegments(panelGeo, satLineMat);
    satelliteGroup.add(panelLines);

    masterTiltGroup.add(satelliteGroup);

    // Dashed Orbit Elliptical Line (LEO altitude radius ~1.18)
    const orbitRadius = 1.18;
    const orbitPoints = [];
    const orbitSegments = 128;
    for (let i = 0; i <= orbitSegments; i++) {
      const t = (i / orbitSegments) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(
        Math.cos(t) * orbitRadius,
        Math.sin(t) * orbitRadius * 0.35,
        Math.sin(t) * orbitRadius * 0.94
      ));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineDashedMaterial({
      color: '#7ec8f2',
      dashSize: 0.035,
      gapSize: 0.028,
      transparent: true,
      opacity: 0.32,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLine.computeLineDistances();
    masterTiltGroup.add(orbitLine);

    // Initial orientation: Centered gracefully on India & active South Asia thermal clusters
    globeGroup.rotation.y = 1.32;

    // 7. Interactive 3D Rotation Controls (Mouse & Touch Trackball Feel)
    let isDragging = false;
    let previousPos = { x: 0, y: 0 };

    const handlePointerDown = (clientX, clientY) => {
      isDragging = true;
      previousPos = { x: clientX, y: clientY };
    };

    const handlePointerMove = (clientX, clientY) => {
      if (!isDragging) return;
      const deltaX = clientX - previousPos.x;
      const deltaY = clientY - previousPos.y;

      globeGroup.rotation.y += deltaX * 0.005;
      masterTiltGroup.rotation.x += deltaY * 0.005;
      masterTiltGroup.rotation.x = Math.max(-0.7, Math.min(0.7, masterTiltGroup.rotation.x));

      previousPos = { x: clientX, y: clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const onMouseDown = (e) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handlePointerUp();

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // 8. Animation Loop (True 3D Rotation with Subtle Axial Precession & Satellite Glide)
    const clock = new THREE.Clock();
    let animId;
    let isVisible = true;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      // Continuous 3D rotation around tilted Earth axis
      if (!isDragging && !prefersReducedMotion) {
        globeGroup.rotation.y += 0.0016;
        // Subtle 3D nutation wobble
        masterTiltGroup.rotation.x = 0.22 + Math.sin(elapsedTime * 0.25) * 0.035;
      }

      // Animate pulsing radar rings on the surface
      pulseRings.forEach((ring, idx) => {
        const s = 1 + Math.sin(elapsedTime * 3 + idx) * 0.25;
        ring.scale.set(s, s, s);
        ring.material.opacity = 0.28 - (s - 0.75) * 0.15;
      });

      // Animate wireframe satellite gliding smoothly along the orbit
      const satAngle = elapsedTime * 0.40;
      const satX = Math.cos(satAngle) * orbitRadius;
      const satY = Math.sin(satAngle) * orbitRadius * 0.35;
      const satZ = Math.sin(satAngle) * orbitRadius * 0.94;
      satelliteGroup.position.set(satX, satY, satZ);

      // Align satellite along flight tangent vector
      const tangent = new THREE.Vector3(
        -Math.sin(satAngle) * orbitRadius,
        Math.cos(satAngle) * orbitRadius * 0.35,
        Math.cos(satAngle) * orbitRadius * 0.94
      ).normalize();
      satelliteGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      renderer.render(scene, camera);
    };

    animate();

    // 9. IntersectionObserver: Pause loop when scrolled out of view (0% idle CPU)
    const intersectionObserver = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    intersectionObserver.observe(container);

    // 10. Resize Observer for Adaptive Viewport
    const updateSize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      motionQuery.removeEventListener('change', handleMotionChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [hasWebGL]);

  if (!hasWebGL) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[400px] text-[#7ec8f2]/15">
          <circle cx="100" cy="100" r="95" fill="#0c1017" stroke="currentColor" strokeWidth="1" />
          <ellipse cx="100" cy="100" rx="95" ry="32" fill="none" stroke="currentColor" strokeWidth="1" />
          <ellipse cx="100" cy="100" rx="95" ry="64" fill="none" stroke="currentColor" strokeWidth="1" />
          <line x1="100" y1="5" x2="100" y2="195" stroke="currentColor" strokeWidth="1" />
          <line x1="5" y1="100" x2="195" y2="100" stroke="currentColor" strokeWidth="1" />
          <circle cx="85" cy="80" r="4" fill="#ff5a1f" />
          <circle cx="85" cy="80" r="8" fill="none" stroke="#ff5a1f" strokeWidth="1" opacity="0.6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
      />
    </div>
  );
}
