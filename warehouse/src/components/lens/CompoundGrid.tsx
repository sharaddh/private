import { POWER_VALUES } from "../../constants";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

export default function CompoundGrid({ quantities, onIncrement, onDecrement }: Props) {
  return (
    <div className="rounded-md border border-th-border overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin">
      <table className="border-collapse text-center">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 bg-th-elevated p-1 text-micro font-bold text-th-secondary border border-th-border min-w-[48px]">
              SPH↓ CYL→
            </th>
            {POWER_VALUES.map((cyl) => (
              <th
                key={cyl}
                className="p-1 text-micro font-bold text-th-secondary border border-th-border min-w-[38px] bg-th-elevated"
              >
                {cyl}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POWER_VALUES.map((sph) => (
            <tr key={sph}>
              <td className="sticky left-0 z-10 bg-th-elevated p-1 text-micro font-bold text-th-secondary border border-th-border whitespace-nowrap">
                {sph}
              </td>
              {POWER_VALUES.map((cyl) => {
                const key = `${sph}|${cyl}`;
                const qty = quantities[key] || 0;
                const hasStock = qty > 0;
                return (
                  <td
                    key={cyl}
                    className={`p-0 border border-th-border transition-colors ${
                      hasStock ? "bg-primary-500/8" : "hover:bg-th-elevated"
                    }`}
                  >
                    <div className="flex flex-col items-center py-1 px-0.5 gap-0.5 min-w-[36px]">
                      <span className={`text-micro font-bold leading-none ${hasStock ? "text-primary-500" : "text-th-muted"}`}>
                        {qty}
                      </span>
                      <div className="flex gap-px">
                        <button
                          onClick={() => onDecrement(key)}
                          className="w-4 h-4 rounded-sm bg-negative/15 text-negative flex items-center justify-center text-micro font-bold hover:bg-negative/25 transition-colors"
                        >
                          -
                        </button>
                        <button
                          onClick={() => onIncrement(key)}
                          className="w-4 h-4 rounded-sm bg-primary-500/15 text-primary-500 flex items-center justify-center text-micro font-bold hover:bg-primary-500/25 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
