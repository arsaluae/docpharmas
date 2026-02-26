import { motion, AnimatePresence } from "framer-motion";

interface PulseRippleProps {
  show: boolean;
  originX: number;
  originY: number;
  onComplete: () => void;
}

export function PulseRipple({ show, originX, originY, onComplete }: PulseRippleProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          onAnimationComplete={onComplete}
        >
          <motion.div
            className="absolute rounded-full bg-primary/30"
            style={{
              left: originX,
              top: originY,
              width: 40,
              height: 40,
              marginLeft: -20,
              marginTop: -20,
            }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 30, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
