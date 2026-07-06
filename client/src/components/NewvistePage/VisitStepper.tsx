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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm px-5 py-4">

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

                    <div className="ml-5 mr-5 h-[2px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">

                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: completed ? "100%" : "0%",
                        }}
                        transition={{
                          duration: .45,
                        }}
                        className="h-full bg-emerald-500"
                      />

                    </div>

                  </div>
                )}

                {/* STEP */}

                <motion.button
                  layout
                  whileHover={
                    completed || active
                      ? {
                          y: -2,
                          scale: 1.05,
                        }
                      : {}
                  }
                  whileTap={{
                    scale: .96,
                  }}
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
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : active
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/25 ring-4 ring-primary-500/10"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
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
                        ? "text-emerald-600 dark:text-emerald-400"
                        : active
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-slate-500 dark:text-slate-400"
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