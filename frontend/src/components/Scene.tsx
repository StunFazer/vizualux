import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import { useStore } from '../store/useStore'
import { Asteroids } from './modes/Asteroids'
import { FluidSimulation } from './modes/FluidSimulation'
import { KoiPond } from './modes/KoiPond'
import { MotionReveal } from './modes/MotionReveal'
import { ScatterLeaves } from './modes/ScatterLeaves'
import { Sparkles } from './modes/Sparkles'
import { ParticleTrail } from './modes/ParticleTrail'
import { SandyShore } from './modes/SandyShore'
import { KinematicColliders } from './KinematicColliders'
import { Environment } from '@react-three/drei'

export function Scene() {
  const currentMode = useStore((state) => state.currentMode)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#050508']} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <Environment preset="city" />

        <Suspense fallback={null}>
          {currentMode === 'Asteroids' && (
            <Physics gravity={[0, 0, 0]}>
              <KinematicColliders />
              <Asteroids />
            </Physics>
          )}

          {currentMode === 'FluidSimulation' && (
            <FluidSimulation />
          )}

          {currentMode === 'KoiPond' && (
            <KoiPond />
          )}

          {currentMode === 'MotionReveal' && (
            <MotionReveal />
          )}

          {currentMode === 'ScatterLeaves' && (
            <ScatterLeaves />
          )}

          {currentMode === 'Sparkles' && (
            <Sparkles />
          )}

          {currentMode === 'ParticleTrail' && (
            <ParticleTrail />
          )}

          {currentMode === 'SandyShore' && (
            <SandyShore />
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}
