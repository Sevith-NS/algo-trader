'use client';

import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Preload } from '@react-three/drei';
import * as THREE from 'three';
import Link from 'next/link';
import styles from './page.module.css';

// A dynamic 3D shape that follows mouse movement
function InteractiveShape() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useFrame((state) => {
    // Smoothly interpolate mouse position
    const targetX = (state.pointer.x * viewport.width) / 2;
    const targetY = (state.pointer.y * viewport.height) / 2;
    
    if (meshRef.current) {
      // Lerp for smooth cursor following
      meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.1;
      meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1;
      
      // Gentle rotation
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.015;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[1.5, 0.4, 128, 32]} />
        <meshPhysicalMaterial 
          color="#00FF88" 
          metalness={0.9} 
          roughness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          emissive="#00FF88"
          emissiveIntensity={0.2}
          wireframe={true}
        />
      </mesh>
    </Float>
  );
}

// Background particles that subtly react to camera
function BackgroundParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  
  const particleCount = 1000;
  const positions = new Float32Array(particleCount * 3);
  
  for(let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 30; // spread loosely
  }

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
      particlesRef.current.rotation.x = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#3B82F6" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.main}>
      {/* 3D Canvas Layer */}
      <div className={styles.canvasContainer}>
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <InteractiveShape />
          <BackgroundParticles />
          <Environment preset="city" />
          <Preload all />
        </Canvas>
      </div>

      {/* Foreground Hero Content */}
      <div className={styles.hero}>
        <h1 className={styles.title}>
          Trade with <span className={styles.highlight}>Precision.</span>
        </h1>
        <p className={styles.subtitle}>
          The next generation stock screener powered by advanced Machine Learning, Markowitz Portfolio Optimization, and professional charting.
        </p>
        <Link href="/screener" className={styles.ctaButton}>
          Launch Platform
        </Link>
      </div>
    </main>
  );
}
