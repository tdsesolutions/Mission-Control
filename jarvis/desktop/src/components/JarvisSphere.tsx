import { motion } from 'framer-motion';

export function JarvisSphere() {
  return (
    <div className="jarvis-sphere-container">
      <motion.div
        className="sphere-3d"
        animate={{
          rotateX: [0, 360],
          rotateY: [0, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Wireframe rings */}
        <div className="sphere-ring" />
        <div className="sphere-ring" />
        <div className="sphere-ring" />
        <div className="sphere-ring" />
        <div className="sphere-ring" />

        {/* Core glow */}
        <div className="sphere-core-glow" />
      </motion.div>
    </div>
  );
}
