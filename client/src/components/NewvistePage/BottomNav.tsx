import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  MessageCircle,
} from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface Props {
  currentIdx: number;
  step: string;
  setStep: (s: string) => void;
  stepKeys: string[];
  saveTransaction: () => void;
  saving: boolean;
  countdown: number;
}

export default function BottomNav({
  currentIdx,
  setStep,
  stepKeys,
  saveTransaction,
  saving,
  countdown,
}: Props) {
  const { uiT } = useTranslate();
  const isFirstStep = currentIdx === 0;
  const isLastStep = currentIdx === stepKeys.length - 1;

  return (
    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="flex items-center justify-between">
        {/* Back Button */}
        <motion.button
          whileHover={!isFirstStep ? { scale: 1.02 } : {}}
          whileTap={!isFirstStep ? { scale: 0.98 } : {}}
          disabled={isFirstStep}
          onClick={() => setStep(stepKeys[currentIdx - 1])}
          className="
            inline-flex items-center gap-2
            px-5 py-2.5
            rounded-xl
            border
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-700 dark:text-slate-200
            hover:bg-slate-100 dark:hover:bg-slate-700
            transition-all
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >
          <ChevronLeft size={18} />
          {uiT("Back", "पीछे")}
        </motion.button>

        {/* Next / Save */}
        {isLastStep ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={saving}
            onClick={saveTransaction}
            className="
              inline-flex items-center gap-2
              px-6 py-2.5
              rounded-xl
              bg-primary-600
              hover:bg-primary-700
              text-white
              font-medium
              shadow-sm
              transition-all
              disabled:opacity-50
            "
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uiT("Saving...", "सेव हो रहा है...")}
              </>
            ) : countdown > 0 ? (
              <>
                <MessageCircle size={18} />
                WhatsApp ({countdown})
              </>
            ) : (
              <>
                <Save size={18} />
                {uiT("Save Visit", "यात्रा सेव करें")}
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setStep(stepKeys[currentIdx + 1])}
            className="
              inline-flex items-center gap-2
              px-6 py-2.5
              rounded-xl
              bg-primary-600
              hover:bg-primary-700
              text-white
              font-medium
              shadow-sm
              transition-all
            "
          >
            {uiT("Next", "अगला")}
            <ChevronRight size={18} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
