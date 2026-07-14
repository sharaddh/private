import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

interface Step {
  key: string;
  label: string;
  icon: any;
}

interface Props {
  steps: Step[];
  currentIdx: number;
  setStep: (key: string) => void;
}

export default function VisitStepper({
  steps,
  currentIdx,
  setStep,
}: Props) {
  return (
    <div className="mb-6">
        <div className="rounded-lg bg-th-surface shadow-lg px-5 py-4">

        <div className="flex items-start overflow-x-auto">

          {steps.map((step, index) => {
            const Icon = step.icon;

            const completed = index < currentIdx;
            const active = index === currentIdx;

            return (
              <div
                key={step.key}
                className="relative flex-1 min-w-[95px] flex flex-col items-center"
              >

                {/* LINE */}

                {index !== steps.length - 1 && (
                  <div className="absolute top-5 left-1/2 w-full">

                    <div className="ml-5 mr-5 h-[2px] rounded-full bg-th-elevated overflow-hidden">

                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: completed ? "100%" : "0%",
                        }}
                        transition={{
                          duration: .45,
                        }}
                        className="h-full bg-[#1ed760]"
                      />

                    </div>

                  </div>
                )}

                {/* STEP */}

                <motion.button
                  layout
                  whileTap={
                    completed || active
                      ? { scale: 0.95 }
                      : {}
                  }
                  disabled={!completed && !active}
                  onClick={() => {
                    if (completed || active)
                      setStep(step.key);
                  }}
                  className="relative z-10 flex flex-col items-center"
                >

                  <motion.div
                    layout
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 22,
                    }}
                    className={`
                    relative
                    flex
                    items-center
                    justify-center

                    h-10
                    w-10

                    rounded-full

                    transition-all

                    ${
                      completed
                        ? "bg-[#1ed760] text-black"
                        : active
                        ? "bg-[#1ed760] text-black ring-4 ring-[#1ed760]/20"
                        : "bg-th-elevated text-th-secondary"
                    }
                  `}
                  >
                    <AnimatePresence mode="wait">

                      {completed ? (
                        <motion.div
                          key="check"
                          initial={{
                            scale: .3,
                            opacity: 0,
                          }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                          }}
                          exit={{
                            scale: .3,
                            opacity: 0,
                          }}
                        >
                          <Check size={18} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="icon"
                          initial={{
                            scale: .3,
                            opacity: 0,
                          }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                          }}
                          exit={{
                            scale: .3,
                            opacity: 0,
                          }}
                        >
                          <Icon size={18} />
                        </motion.div>
                      )}

                    </AnimatePresence>

                  </motion.div>

                  <motion.span
                    layout
                    className={`
                    mt-2
                    text-xs
                    font-medium
                    whitespace-nowrap
                    transition-colors

                    ${
                      completed
                        ? "text-[#1ed760]"
                        : active
                        ? "text-[#1ed760]"
                        : "text-th-secondary"
                    }
                  `}
                  >
                    {step.label}
                  </motion.span>

                </motion.button>

              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}