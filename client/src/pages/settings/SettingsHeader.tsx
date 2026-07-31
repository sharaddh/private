import { Building2 } from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";
import type { User } from "../../types";

interface SettingsHeaderProps {
  user: User | null;
  currentBranch: { _id: string; name: string; code: string; dbName: string; isActive: boolean } | null;
  branches: { _id: string; name: string; code: string; dbName: string; isActive: boolean }[];
  isStaff: boolean;
  onSwitchBranch: (id: string) => void;
}

export default function SettingsHeader({
  user,
  currentBranch,
  branches,
  isStaff,
  onSwitchBranch,
}: SettingsHeaderProps) {
  const { uiT } = useTranslate();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-th-text">{uiT("Settings", "सेटिंग्स")}</h1>
        </div>
        <p className="text-sm text-th-secondary mt-1">
          {uiT("Configure your application preferences", "अपनी ऐप प्राथमिकताएं कॉन्फ़िगर करें")}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!isStaff && branches.length > 0 && (
          <div className="flex items-center gap-1 bg-th-elevated rounded-lg p-1">
            {branches.map((b) => (
              <button
                key={b._id}
                onClick={() => onSwitchBranch(b._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  currentBranch?._id === b._id
                    ? "bg-[#1ed760] text-black"
                    : "text-th-secondary hover:text-th-text hover:bg-th-hover"
                }`}
              >
                <Building2 size={14} />
                {b.name}
              </button>
            ))}
          </div>
        )}
        <div className="w-9 h-9 rounded-full bg-[#1ed760] flex items-center justify-center text-black text-sm font-bold shrink-0">
          {((user?.name as string) || (user?.username as string) || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  );
}
