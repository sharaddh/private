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
    <div className="mt-8 border-t border-[#1f1f1f] pt-6">
      <div className="flex items-center justify-between">
        {/* Back Button */}
        <motion.button
          whileTap={!isFirstStep ? { scale: 0.95 } : {}}
          disabled={isFirstStep}
          onClick={() => setStep(stepKeys[currentIdx - 1])}
          className="
            inline-flex items-center gap-2
            px-5 py-2.5
            rounded-lg
            bg-th-elevated
            text-th-text
            transition-all
            disabled:opacity-40
            disabled:cursor-not-allowed
            hover:bg-th-card
          "
        >
          <ChevronLeft size={18} />
          {uiT("Back", "पीछे")}
        </motion.button>

        {/* Next / Save */}
        {isLastStep ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            disabled={saving}
            onClick={saveTransaction}
            className="
              inline-flex items-center gap-2
              px-6 py-2.5
              rounded-lg
              bg-[#1ed760]
              text-black
              font-bold
              uppercase tracking-wider text-xs
              transition-all
              disabled:opacity-50
            "
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
            whileTap={{ scale: 0.95 }}
            onClick={() => setStep(stepKeys[currentIdx + 1])}
            className="
              inline-flex items-center gap-2
              px-6 py-2.5
              rounded-lg
              bg-[#1ed760]
              text-black
              font-bold
              uppercase tracking-wider text-xs
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
