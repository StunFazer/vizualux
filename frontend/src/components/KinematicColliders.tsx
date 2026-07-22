import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RapierRigidBody, RigidBody, BallCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useTracker } from '../hooks/useTracker'

export function KinematicColliders() {
  const trackingDataRef = useTracker()
  
  // Refs for our kinematic rigid bodies (hands & feet)
  const leftHandRef = useRef<RapierRigidBody>(null)
  const rightHandRef = useRef<RapierRigidBody>(null)
  const leftFootRef = useRef<RapierRigidBody>(null)
  const rightFootRef = useRef<RapierRigidBody>(null)
  
  const vec = new THREE.Vector3()

  useFrame(({ viewport }) => {
    const data = trackingDataRef.current
    if (!data.is_tracking) return

    // Normalised coordinates are [0, 1] from top-left.
    // Three.js viewport is centered at 0,0.
    
    // Helper to map normalized [0,1] to World Space based on current camera viewport
    const mapToWorld = (normX: number, normY: number, targetRef: React.RefObject<RapierRigidBody | null>) => {
      if (!targetRef.current) return
      
      // X: 0 is left, 1 is right. Map to [-viewport.width/2, viewport.width/2]
      const worldX = (normX - 0.5) * viewport.width
      // Y: 0 is top, 1 is bottom. Map to [viewport.height/2, -viewport.height/2]
      const worldY = -(normY - 0.5) * viewport.height
      
      // Set directly for lowest latency
      vec.set(worldX, worldY, 0)
      targetRef.current.setNextKinematicTranslation(vec)
    }

    if (data.left_hand) {
      mapToWorld(data.left_hand.x, data.left_hand.y, leftHandRef)
    }
    if (data.right_hand) {
      mapToWorld(data.right_hand.x, data.right_hand.y, rightHandRef)
    }
    if (data.left_foot) {
      mapToWorld(data.left_foot.x, data.left_foot.y, leftFootRef)
    }
    if (data.right_foot) {
      mapToWorld(data.right_foot.x, data.right_foot.y, rightFootRef)
    }
  })

  return (
    <>
      <RigidBody ref={leftHandRef} type="kinematicPosition" colliders={false}>
        <BallCollider args={[0.5]} />
      </RigidBody>
      <RigidBody ref={rightHandRef} type="kinematicPosition" colliders={false}>
        <BallCollider args={[0.5]} />
      </RigidBody>
      <RigidBody ref={leftFootRef} type="kinematicPosition" colliders={false}>
        <BallCollider args={[0.5]} />
      </RigidBody>
      <RigidBody ref={rightFootRef} type="kinematicPosition" colliders={false}>
        <BallCollider args={[0.5]} />
      </RigidBody>
    </>
  )
}
