import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Globally distributed thermal hotspots across multiple continents
// Mix of Red (Critical Fire) & Amber/Yellow (Industrial Warning)
const HOTSPOTS = [
  // Asia
  { lat: 22.4707, lng: 70.0577, color: '#DC2626', name: 'Jamnagar Petrochem, South Asia' },
  { lat: 23.6693, lng: 86.1511, color: '#F5C518', name: 'Bokaro Thermal Complex, India' },
  { lat: -1.2500, lng: 102.3000, color: '#DC2626', name: 'Sumatra Peatland Fire, Indonesia' },
  { lat: -2.9500, lng: 114.5000, color: '#F5C518', name: 'Kalimantan Thermal Spot, Indonesia' },
  { lat: 56.5000, lng: 94.2000, color: '#DC2626', name: 'Siberian Taiga Fire, Russia' },

  // Africa
  { lat: -7.8000, lng: 22.5000, color: '#DC2626', name: 'Congo Basin Savanna Fire, DRC' },
  { lat: 4.8500, lng: 6.9500, color: '#F5C518', name: 'Niger Delta Flare Cluster, West Africa' },
  { lat: -12.5000, lng: 25.0000, color: '#DC2626', name: 'Zambia Miombo Fire, Africa' },
  { lat: 31.8000, lng: 5.4000, color: '#F5C518', name: 'Hassi Messaoud Flare, Algeria' },

  // Europe
  { lat: 38.5000, lng: -3.7000, color: '#DC2626', name: 'Iberian Peninsula Thermal, Spain' },
  { lat: 37.8000, lng: 22.4000, color: '#DC2626', name: 'Peloponnese Anomaly, Greece' },

  // North America
  { lat: 39.7500, lng: -121.6000, color: '#DC2626', name: 'Sierra Thermal Anomaly, California' },
  { lat: 29.7604, lng: -95.3698, color: '#F5C518', name: 'Gulf Coast Industrial Zone, Texas' },
  { lat: 54.8000, lng: -115.5000, color: '#DC2626', name: 'Alberta Boreal Fire, Canada' },

  // South America
  { lat: -11.5000, lng: -55.5000, color: '#DC2626', name: 'Mato Grosso Active Fire, Brazil' },
  { lat: -17.8000, lng: -57.2000, color: '#DC2626', name: 'Pantanal Wetland Hotspot, Brazil' },
  { lat: -26.0000, lng: -60.5000, color: '#F5C518', name: 'Gran Chaco Thermal Spot, Argentina' },

  // Australia
  { lat: -14.8000, lng: 133.2000, color: '#DC2626', name: 'Katherine Savanna Anomaly, Australia' },
  { lat: -21.1500, lng: 119.7500, color: '#F5C518', name: 'Pilbara Mining Thermal, Australia' },
  { lat: -19.4000, lng: 145.2000, color: '#DC2626', name: 'Queensland Bushfire Ping, Australia' },
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

    // 2. Base Sphere: Clean light translucent sphere with warm landmass silhouettes
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base light ocean matching Main Website's #FAFAF8 surface
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;

    // Load vector equirectangular light landmass SVG
    const landImg = new Image();
    landImg.onload = () => {
      ctx.drawImage(landImg, 0, 0, canvas.width, canvas.height);
      canvasTexture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    landImg.src = '/media/earth_vector_land_light.svg';

    const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      map: canvasTexture,
      transparent: true,
      opacity: 0.98,
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
      color: '#D8D4CA',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const rimLine = new THREE.Line(rimGeo, rimMat);
    scene.add(rimLine);

    // 4. Subtle 3D Wireframe Grid Lines (Properly clamped on the 1.002 sphere surface)
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: '#C8C4B8',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    // Parallels (every 20 degrees)
    for (let lat = -60; lat <= 60; lat += 20) {
      const phi = (90 - lat) * (Math.PI / 180);
      const r = 1.002 * Math.sin(phi);
      const y = 1.002 * Math.cos(phi);
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Meridians (every 30 degrees, mathematically exact on sphere surface)
    for (let lng = 0; lng < 360; lng += 30) {
      const theta = (lng * Math.PI) / 180;
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const lat = (i / segments) * Math.PI - Math.PI / 2;
        const y = 1.002 * Math.sin(lat);
        const r = 1.002 * Math.cos(lat);
        points.push(new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }
    globeGroup.add(gridGroup);

    // 5. Standalone Hotspot Markers: Randomly spread across continents (Red + Amber)
    const hotspotsGroup = new THREE.Group();
    const hotspotInstances = [];

    HOTSPOTS.forEach((pt, index) => {
      const phi = (90 - pt.lat) * (Math.PI / 180);
      const theta = (pt.lng + 180) * (Math.PI / 180);

      const radius = 1.005;
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);

      const normal = new THREE.Vector3(x, y, z).normalize();

      // Outer soft pulsing halo disc on the globe surface
      const haloGeo = new THREE.RingGeometry(0, 0.046, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: pt.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(x * 1.002, y * 1.002, z * 1.002);
      haloMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      hotspotsGroup.add(haloMesh);

      // Solid standalone beacon dot (Red #DC2626 or Amber #F5C518)
      const pointGeo = new THREE.SphereGeometry(0.018, 16, 16);
      const pointMat = new THREE.MeshBasicMaterial({
        color: pt.color,
        transparent: true,
        opacity: 1,
      });
      const pointMesh = new THREE.Mesh(pointGeo, pointMat);
      pointMesh.position.set(x, y, z);
      hotspotsGroup.add(pointMesh);

      // Bright white thermal center core
      const coreGeo = new THREE.SphereGeometry(0.008, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 1,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(x, y, z);
      hotspotsGroup.add(coreMesh);

      hotspotInstances.push({
        index,
        normal,
        haloMesh,
        pointMesh,
        coreMesh,
      });
    });

    globeGroup.add(hotspotsGroup);

    // 6. Orbiting Satellite and Dashed Orbit Track
    const orbitRadius = 1.22;
    const orbitGroup = new THREE.Group();

    // Dashed orbital track
    const orbitPoints = [];
    const orbitSegments = 128;
    for (let i = 0; i <= orbitSegments; i++) {
      const t = (i / orbitSegments) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(
        Math.cos(t) * orbitRadius,
        Math.sin(t) * orbitRadius * 0.32,
        Math.sin(t) * orbitRadius * 0.95
      ));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineDashedMaterial({
      color: '#94A3B8',
      dashSize: 0.035,
      gapSize: 0.025,
      transparent: true,
      opacity: 0.35,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLine.computeLineDistances();
    orbitGroup.add(orbitLine);

    // Satellite model (Central bus + dual solar array wings)
    const satellite = new THREE.Group();

    // Main bus body
    const bodyGeo = new THREE.BoxGeometry(0.022, 0.022, 0.032);
    const bodyMat = new THREE.MeshBasicMaterial({ color: '#1A1A17' });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    satellite.add(bodyMesh);

    // Gold thermal foil accent on bus
    const foilGeo = new THREE.BoxGeometry(0.016, 0.016, 0.034);
    const foilMat = new THREE.MeshBasicMaterial({ color: '#F5C518' });
    const foilMesh = new THREE.Mesh(foilGeo, foilMat);
    satellite.add(foilMesh);

    // Left solar panel wing
    const panelGeo = new THREE.BoxGeometry(0.048, 0.003, 0.022);
    const panelMat = new THREE.MeshBasicMaterial({ color: '#2563EB' });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.038, 0, 0);
    satellite.add(leftPanel);

    // Right solar panel wing
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.038, 0, 0);
    satellite.add(rightPanel);

    orbitGroup.add(satellite);
    masterTiltGroup.add(orbitGroup);

    // Initial orientation: Centered gracefully on South Asia & Indian Ocean
    globeGroup.rotation.y = 1.32;

    // 7. Interactive 3D Rotation Controls
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

    // 8. 3-Axis Dynamic Orbital Rotation Animation Loop (Task + User Request)
    const clock = new THREE.Clock();
    let animId;
    let isVisible = true;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      // Continuous 3D rotation on 3 axes:
      // Axis 1 (Y): Continuous planetary spin
      // Axis 2 (X): Earth axial tilt nutation
      // Axis 3 (Z): Orbital precession wobble
      if (!isDragging && !prefersReducedMotion) {
        globeGroup.rotation.y += 0.0022;
        masterTiltGroup.rotation.x = 0.22 + Math.sin(elapsedTime * 0.35) * 0.08;
        masterTiltGroup.rotation.z = (23.5 * Math.PI / 180) + Math.cos(elapsedTime * 0.25) * 0.04;
      }

      // Satellite orbiting smoothly around the Earth
      const satSpeed = elapsedTime * 0.45;
      const satX = Math.cos(satSpeed) * orbitRadius;
      const satY = Math.sin(satSpeed) * orbitRadius * 0.32;
      const satZ = Math.sin(satSpeed) * orbitRadius * 0.95;
      satellite.position.set(satX, satY, satZ);

      // Tangent alignment along flight path
      const tangent = new THREE.Vector3(
        -Math.sin(satSpeed) * orbitRadius,
        Math.cos(satSpeed) * orbitRadius * 0.32,
        Math.cos(satSpeed) * orbitRadius * 0.95
      ).normalize();
      satellite.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      // Hotspot depth scaling & rotation fading
      hotspotInstances.forEach((pt) => {
        const normalWorld = pt.normal.clone()
          .applyQuaternion(globeGroup.quaternion)
          .applyQuaternion(masterTiltGroup.quaternion);

        const facing = normalWorld.z;
        const isFacing = facing > 0;
        const depth = isFacing ? Math.max(0, Math.min(1, (facing - 0.05) / 0.35)) : 0;

        const pulse = 1 + Math.sin(elapsedTime * 3.2 + pt.index * 0.6) * 0.35;
        const ringScale = pulse * depth;
        pt.haloMesh.scale.set(ringScale, ringScale, ringScale);
        pt.haloMesh.material.opacity = (0.40 - (pulse - 1) * 0.24) * depth;

        pt.pointMesh.scale.set(depth, depth, depth);
        pt.coreMesh.scale.set(depth, depth, depth);
        pt.pointMesh.material.opacity = depth;
        pt.coreMesh.material.opacity = depth;
      });

      renderer.render(scene, camera);
    };

    animate();

    // 9. IntersectionObserver: Pause loop when scrolled out of view
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
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[400px] text-[#C8C4B8]/30">
          <circle cx="100" cy="100" r="95" fill="#FAFAF8" stroke="#D8D4CA" strokeWidth="1" />
          <circle cx="85" cy="80" r="4" fill="#DC2626" />
          <circle cx="85" cy="80" r="8" fill="none" stroke="#DC2626" strokeWidth="1" opacity="0.6" />
          <circle cx="120" cy="95" r="4" fill="#F5C518" />
          <circle cx="120" cy="95" r="8" fill="none" stroke="#F5C518" strokeWidth="1" opacity="0.6" />
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
