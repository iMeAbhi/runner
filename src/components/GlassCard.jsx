import { motion } from 'framer-motion';

/**
 * Liquid-glass surface primitive. Frosted backdrop blur, translucent border,
 * soft inner sheen — the building block for every floating panel.
 */
export default function GlassCard({ children, className = '', strong = false, as = motion.div, ...rest }) {
  const Comp = as;
  return (
    <Comp
      className={`${strong ? 'glass-strong' : 'glass'} rounded-4xl ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
}
