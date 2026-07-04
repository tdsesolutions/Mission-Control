import { motion } from 'framer-motion';

export function JarvisWave() {
  return (
    <div className="jarvis-wave-container">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="wave-ring"
          initial={{ width: 100, height: 100, opacity: 0.8 }}
          animate={{ width: 800, height: 800, opacity: 0 }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 0.8,
            ease: 'easeOut',
          }}
          style={{
            borderColor: i % 2 === 0 ? 'var(--j-primary)' : 'var(--j-secondary)',
          }}
        />
      ))}

      {/* Center core */}
      <motion.div
        className="absolute w-32 h-32 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--j-primary) 0%, transparent 70%)',
          boxShadow: '0 0 60px var(--j-primary)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
