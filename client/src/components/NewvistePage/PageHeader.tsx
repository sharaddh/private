import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  User,
  History,
  Loader2,
} from "lucide-react";

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

const VISIT_TYPE_LABELS: Record<string, string> = {
  new: "New Glasses",
  frame_change: "Frame Change",
  new_lens: "New Lens",
  contact_lens: "Contact Lens",
  service: "Service",
  other: "Other",
};

export default function PageHeader({
  customer,
  id,
  navigate,
  visitType,
  loading,
  saving,
}: Props) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        {/* Left */}

        <div className="flex items-center gap-4 min-w-0">

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: .95 }}
            onClick={() => navigate(`/customers/${id}`)}
            className="h-11 w-11 rounded-xl  text-gray-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <ArrowLeft size={18} />
          </motion.button>

          <div className="h-12 w-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg shadow">

            {customer.name ? (
              customer.name.charAt(0).toUpperCase()
            ) : (
              <User size={20} />
            )}

          </div>

          <div className="min-w-0">

            <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">

              {customer.name || "Loading..."}

            </h1>

            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">

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
            <span className="hidden md:flex items-center rounded-full px-4 py-2 text-sm font-medium bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-500/20">

              {VISIT_TYPE_LABELS[visitType]}

            </span>
          )}

          {saving && (
            <div className="hidden lg:flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">

              <Loader2
                size={16}
                className="animate-spin"
              />

              Saving...

            </div>
          )}
        </div>

      </div>
    </header>
  );
}