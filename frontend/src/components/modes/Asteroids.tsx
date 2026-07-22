import { RigidBody } from '@react-three/rapier'
import { Box } from '@react-three/drei'
import { useMemo } from 'react'

export function Asteroids() {
  // Generate some random asteroids
  const instances = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      key: i,
      position: [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5
      ] as [number, number, number],
      scale: Math.random() * 0.5 + 0.2
    }))
  }, [])

  return (
    <>
      {instances.map((props) => (
        <RigidBody key={props.key} position={props.position} colliders="cuboid" restitution={0.8} friction={0.1}>
          <Box args={[props.scale, props.scale, props.scale]}>
            <meshStandardMaterial color="hotpink" />
          </Box>
        </RigidBody>
      ))}
      
      {/* Invisible walls to keep asteroids on screen */}
      <RigidBody type="fixed" position={[0, -6, 0]}>
        <Box args={[20, 1, 10]} visible={false} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, 6, 0]}>
        <Box args={[20, 1, 10]} visible={false} />
      </RigidBody>
      <RigidBody type="fixed" position={[-10, 0, 0]}>
        <Box args={[1, 12, 10]} visible={false} />
      </RigidBody>
      <RigidBody type="fixed" position={[10, 0, 0]}>
        <Box args={[1, 12, 10]} visible={false} />
      </RigidBody>
    </>
  )
}
