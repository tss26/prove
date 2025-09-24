import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Un componente che contiene il modello 3D della maglietta
function Shirt({ designTexture }) {
  const { nodes, materials } = useGLTF('/models/tshirt.gltf');
  const material = useRef();

  // Aggiorna la texture del materiale quando il design cambia
  useEffect(() => {
    if (designTexture) {
      material.current.map = designTexture;
      material.current.needsUpdate = true;
    }
  }, [designTexture]);

  return (
    <mesh
      geometry={nodes.tshirt.geometry}
      material={materials.tshirt} // Il materiale di base del modello
    >
      <meshStandardMaterial ref={material} color="#ffffff" />
    </mesh>
  );
}

const TshirtScene = ({ designData }) => {
  const [designTexture, setDesignTexture] = useState(null);

  // Crea una texture 3D dai dati del canvas 2D
  useEffect(() => {
    if (designData) {
      const texture = new THREE.TextureLoader().load(designData);
      setDesignTexture(texture);
    }
  }, [designData]);

  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <Shirt designTexture={designTexture} />
      <OrbitControls />
    </Canvas>
  );
};

export default TshirtScene;
