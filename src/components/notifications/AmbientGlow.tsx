import { useNotifications } from "@/hooks/useNotifications";
import { AnimatePresence, motion } from "framer-motion";

const glowColors: Record<string, string> = {
  teal: "rgba(20, 184, 166, 0.5)",
  amber: "rgba(139, 92, 246, 0.5)",
  red: "rgba(236, 72, 153, 0.5)",
  info: "rgba(79, 109, 247, 0.5)",
};

export function AmbientGlow({ children }: { children: React.ReactNode }) {
  const { activeGlow, dismissGlow } = useNotifications();
  const color = activeGlow ? glowColors[activeGlow] || glowColors.info : null;

  return (
    <div className="relative">
      <AnimatePresence>
        {color && (
          <>
            {/* Top */}
            <motion.div
              key="glow-top"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1, 0] }}
              transition={{ duration: 5, ease: "easeInOut" }}
              onAnimationComplete={dismissGlow}
              className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none"
              style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }}
            />
            {/* Bottom */}
            <motion.div
              key="glow-bottom"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1, 0] }}
              transition={{ duration: 5, ease: "easeInOut" }}
              className="fixed bottom-0 left-0 right-0 h-1 z-50 pointer-events-none"
              style={{ background: `linear-gradient(to top, ${color}, transparent)` }}
            />
            {/* Left */}
            <motion.div
              key="glow-left"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1, 0] }}
              transition={{ duration: 5, ease: "easeInOut" }}
              className="fixed top-0 bottom-0 left-0 w-1 z-50 pointer-events-none"
              style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
            />
            {/* Right */}
            <motion.div
              key="glow-right"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1, 0] }}
              transition={{ duration: 5, ease: "easeInOut" }}
              className="fixed top-0 bottom-0 right-0 w-1 z-50 pointer-events-none"
              style={{ background: `linear-gradient(to left, ${color}, transparent)` }}
            />
          </>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
