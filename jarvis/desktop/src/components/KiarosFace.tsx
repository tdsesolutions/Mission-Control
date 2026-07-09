/**
 * KiarosFace — the executive interface visualization.
 * A faceted, mask-like AI face (angular hero-mask inspired) with large
 * expressive eyes, rendered in the turquoise/purple system palette.
 * Expressions are driven by the live voice/conversation state:
 *   idle → calm breathing glow + periodic blink
 *   listening → eyes widen, turquoise intensifies
 *   recognizing → focused squint with scan shimmer
 *   thinking → narrowed eyes, purple shift
 *   speaking → rhythmic eye-glow pulses + chin voice chevrons
 *   error → crimson flash, then calm
 */

import { motion } from 'framer-motion';
import { useVoiceStore } from '../stores/voiceStore';
import { useJarvisStore } from '../stores/jarvisStore';

type Expression = 'idle' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'error';

function deriveExpression(
  voiceState: string,
  chatStatus: string,
  isConnected: boolean
): Expression {
  if (voiceState === 'error') return 'error';
  if (voiceState === 'speaking') return 'speaking';
  if (voiceState === 'recognizing') return 'recognizing';
  if (voiceState === 'listening') return 'listening';
  if (voiceState === 'thinking' || chatStatus === 'thinking') return 'thinking';
  if (!isConnected) return 'thinking';
  return 'idle';
}

/** Per-expression eye presentation. */
const EYE_VARIANTS = {
  idle: { scaleY: 1, scaleX: 1, opacity: 0.92 },
  listening: { scaleY: 1.12, scaleX: 1.06, opacity: 1 },
  recognizing: { scaleY: 0.82, scaleX: 1.04, opacity: 1 },
  thinking: { scaleY: 0.55, scaleX: 1, opacity: 0.9 },
  speaking: { scaleY: 1, scaleX: 1, opacity: 1 },
  error: { scaleY: 0.72, scaleX: 0.96, opacity: 1 },
} as const;

const EYE_GLOW = {
  idle: 0.45,
  listening: 0.95,
  recognizing: 0.75,
  thinking: 0.55,
  speaking: 0.9,
  error: 0.85,
} as const;

/**
 * Signature swept eye (reference-proportioned, original rendering):
 * sharp outer-top corner high near the temple, upper lid sweeping
 * diagonally down-inward, tapering to a sharp inner-lower point beside
 * the nose bridge; full lower lid returning to the outer corner.
 */
const EYE_PATH =
  'M -142 -80 C -98 -76, -48 -42, -16 8 C -12 16, -12 24, -18 28 C -58 40, -110 22, -132 -14 C -140 -32, -146 -60, -142 -80 Z';

/** Smooth egg-shaped mask silhouette (full oval crown, rounded chin). */
const HEAD_PATH =
  'M 0 -204 C 90 -204, 150 -144, 154 -48 C 157 40, 122 138, 56 190 C 32 208, -32 208, -56 190 C -122 138, -157 40, -154 -48 C -150 -144, -90 -204, 0 -204 Z';

export function KiarosFace() {
  const { voiceState } = useVoiceStore();
  const { status, isConnected } = useJarvisStore();
  const expression = deriveExpression(voiceState, status, isConnected);

  const eyeColor = expression === 'error' ? 'var(--j-error)' : 'url(#kiaros-eye-grad)';
  const glow = EYE_GLOW[expression];

  return (
    <div className="kiaros-face-container" data-expression={expression}>
      <motion.svg
        viewBox="-220 -230 440 460"
        width="440"
        height="460"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      >
        <defs>
          <linearGradient id="kiaros-eye-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="var(--j-primary)" />
            <stop offset="100%" stopColor="var(--j-primary-deep, #0FA396)" />
          </linearGradient>
          <linearGradient id="kiaros-face-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#241636" />
            <stop offset="45%" stopColor="#151020" />
            <stop offset="100%" stopColor="#08060E" />
          </linearGradient>
          <clipPath id="kiaros-head-clip">
            <path d={HEAD_PATH} />
          </clipPath>
          <radialGradient id="kiaros-aura" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="rgba(20, 224, 200, 0.12)" />
            <stop offset="60%" stopColor="rgba(155, 92, 255, 0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="kiaros-eye-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Ambient aura */}
        <motion.circle
          r="215"
          fill="url(#kiaros-aura)"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Mask silhouette — smooth egg profile, graphite with purple sheen */}
        <path
          d={HEAD_PATH}
          fill="url(#kiaros-face-grad)"
          stroke="var(--j-secondary-dim)"
          strokeWidth="2"
        />

        {/* Web-motif filaments radiating from the brow node, clipped to the
            mask — symmetrical, turquoise, deliberately faint */}
        <g clipPath="url(#kiaros-head-clip)" stroke="var(--j-primary)" fill="none" opacity="0.13">
          {[44, 84, 128, 176, 228].map((r) => (
            <circle key={r} cx="0" cy="-46" r={r} strokeWidth="0.8" strokeDasharray="4 8" />
          ))}
          {Array.from({ length: 14 }, (_, i) => {
            const angle = ((i * (360 / 14)) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={Math.cos(angle) * 24}
                y1={-46 + Math.sin(angle) * 24}
                x2={Math.cos(angle) * 300}
                y2={-46 + Math.sin(angle) * 300}
                strokeWidth="0.6"
              />
            );
          })}
        </g>

        {/* Brow node — abstract diamond where the filaments converge */}
        <motion.path
          d="M 0 -58 L 9 -46 L 0 -30 L -9 -46 Z"
          fill="var(--j-secondary)"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Eyes: mirrored pair (geometry is pre-tilted: sharp outer-top
            corner, sweeping to a sharp inner-lower point at the bridge).
            Outer group = mirror, middle = expression, inner = blink. */}
        {[1, -1].map((side) => (
          <motion.g key={side} transform={`scale(${side}, 1)`}>
            <motion.g
              animate={EYE_VARIANTS[expression]}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              style={{ originX: '-78px', originY: '-26px' }}
            >
              <motion.g
                animate={{ scaleY: [1, 1, 0.06, 1] }}
                transition={{
                  duration: 0.34,
                  times: [0, 0.9, 0.95, 1],
                  repeat: Infinity,
                  repeatDelay: expression === 'idle' ? 3.8 : 7.5,
                }}
                style={{ originX: '-78px', originY: '-26px' }}
              >
                {/* Purple rim halo */}
                <path
                  d={EYE_PATH}
                  fill="none"
                  stroke="var(--j-secondary)"
                  strokeWidth="16"
                  strokeLinejoin="round"
                  opacity="0.28"
                />
                {/* Thick graphite eye border (mask cut-out look) */}
                <path
                  d={EYE_PATH}
                  fill="#0A0810"
                  stroke="#0A0810"
                  strokeWidth="11"
                  strokeLinejoin="round"
                />
                {/* Glow layer */}
                <motion.path
                  d={EYE_PATH}
                  fill={eyeColor}
                  filter="url(#kiaros-eye-blur)"
                  animate={
                    expression === 'speaking'
                      ? { opacity: [glow * 0.7, glow, glow * 0.7] }
                      : { opacity: glow }
                  }
                  transition={
                    expression === 'speaking'
                      ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.3 }
                  }
                />
                {/* Crisp turquoise lens */}
                <path
                  d={EYE_PATH}
                  fill={eyeColor}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1"
                />
              </motion.g>
            </motion.g>
          </motion.g>
        ))}

        {/* Voice chevrons — pulse while speaking, faint otherwise */}
        <motion.g
          stroke="var(--j-primary)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          animate={
            expression === 'speaking'
              ? { opacity: [0.25, 0.9, 0.25] }
              : { opacity: 0.14 }
          }
          transition={
            expression === 'speaking'
              ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.4 }
          }
        >
          <path d="M -34 118 L 0 138 L 34 118" />
          <path d="M -26 140 L 0 156 L 26 140" />
          <path d="M -18 162 L 0 172 L 18 162" />
        </motion.g>

        {/* Thinking scan line */}
        {(expression === 'thinking' || expression === 'recognizing') && (
          <motion.line
            x1="-130"
            x2="130"
            y1="-30"
            y2="-30"
            stroke="var(--j-secondary)"
            strokeWidth="1"
            opacity="0.5"
            animate={{ y1: [-64, 6, -64], y2: [-64, 6, -64] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.svg>
    </div>
  );
}
