import { motion } from 'framer-motion';

export function JarvisOrb() {
  return (
    <div className="jarvis-orb-container">
      {/* Outer rotating rings */}
      <motion.div
        className="orb-ring orb-ring-1"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="orb-ring orb-ring-2"
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="orb-ring orb-ring-3"
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />

      {/* Status ring */}
      <div className="orb-status-ring" />

      {/* Core orb */}
      <motion.div
        className="orb-core"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [1, 0.85, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Floating particles */}
      <div className="orb-particles">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="orb-particle"
            style={{
              left: `${50 + 35 * Math.cos((i * Math.PI) / 3)}%`,
              top: `${50 + 35 * Math.sin((i * Math.PI) / 3)}%`,
            }}
            animate={{
              scale: [0.5, 1, 0.5],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
