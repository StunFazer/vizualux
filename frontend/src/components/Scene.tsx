import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useStore } from '../store/useStore'
import { ParticleTrail } from './modes/ParticleTrail'
import { WaterRipples } from './modes/WaterRipples'
import { Scatter } from './modes/Scatter'
import { MotionReveal } from './modes/MotionReveal'
import { FluidSimulation } from './modes/FluidSimulation'
import { SilhouetteFX } from './modes/SilhouetteFX'
import { CosmicNebula } from './modes/CosmicNebula'
import { NeonGrid } from './modes/NeonGrid'
import { ElectricPlasma } from './modes/ElectricPlasma'
import { LavaEmbers } from './modes/LavaEmbers'
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
          {currentMode === 'ParticleTrail' && (
            <ParticleTrail />
          )}

          {currentMode === 'WaterRipples' && (
            <WaterRipples />
          )}

          {currentMode === 'Scatter' && (
            <Scatter />
          )}

          {currentMode === 'MotionReveal' && (
            <MotionReveal />
          )}

          {currentMode === 'FluidSimulation' && (
            <FluidSimulation />
          )}

          {currentMode === 'SilhouetteFX' && (
            <SilhouetteFX />
          )}

          {currentMode === 'CosmicNebula' && (
            <CosmicNebula />
          )}

          {currentMode === 'NeonGrid' && (
            <NeonGrid />
          )}

          {currentMode === 'ElectricPlasma' && (
            <ElectricPlasma />
          )}

          {currentMode === 'LavaEmbers' && (
            <LavaEmbers />
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}
