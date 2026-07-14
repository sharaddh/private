import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  User,
  History,
  Loader2,
} from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface Customer {
  name?: string;
  mobile?: string;
}

interface Props {
  customer: Customer;
  id: string;
  navigate: (path: string) => void;
  visitType: string;
  loading: boolean;
  saving: boolean;
}

export default function PageHeader({
  customer,
  id,
  navigate,
  visitType,
  loading,
  saving,
}: Props) {
  const { uiT } = useTranslate();

  const VISIT_TYPE_LABELS: Record<string, string> = {
    new: uiT("New Glasses", "नई चश्मा"),
    frame_change: uiT("Frame Change", "फ्रेम बदलें"),
    new_lens: uiT("New Lens", "नया लेंस"),
    contact_lens: uiT("Contact Lens", "कॉन्टैक्ट लेंस"),
    service: uiT("Service", "सेवा"),
    other: uiT("Other", "अन्य"),
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-th-surface/90 border-b border-th-border shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        {/* Left */}

        <div className="flex items-center gap-4 min-w-0">

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/customers/${id}`)}
            className="h-11 w-11 rounded-lg text-th-text flex items-center justify-center transition hover:bg-th-elevated"
          >
            <ArrowLeft size={18} />
          </motion.button>

          <div className="h-12 w-12 rounded-lg bg-[#1ed760] text-black flex items-center justify-center font-bold text-lg">

            {customer.name ? (
              customer.name.charAt(0).toUpperCase()
            ) : (
              <User size={20} />
            )}

          </div>

          <div className="min-w-0">

            <h1 className="text-lg font-semibold text-th-text truncate">

              {customer.name || uiT("Loading...", "लोड हो रहा है...")}

            </h1>

            <div className="flex items-center gap-3 mt-1 text-sm text-th-secondary">

              {customer.mobile && (
                <span className="flex items-center gap-1">

                  <Phone size={14} />

                  {customer.mobile}

                </span>
              )}

            </div>

          </div>

        </div>

        {/* Right */}

        <div className="flex items-center gap-3">

          {!loading && (
            <span className="hidden md:flex items-center rounded-lg px-4 py-2 text-sm font-bold bg-[#1ed760]/10 text-[#1ed760] shadow-[0_0_0_1px_#1ed760]">

              {VISIT_TYPE_LABELS[visitType]}

            </span>
          )}

          {saving && (
            <div className="hidden lg:flex items-center gap-2 text-sm text-[#1ed760]">

              <Loader2
                size={16}
                className="animate-spin"
              />

              {uiT("Saving...", "सेव हो रहा है...")}

            </div>
          )}
        </div>

      </div>
    </header>
  );
}
