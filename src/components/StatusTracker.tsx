import React from "react";
import { Clock, ChefHat, CheckCircle2, Utensils } from "lucide-react";
import type { OrderStatus } from "../types";

const STATUS_STEPS = [
  { id: "pending" as const, label: "Order Placed", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500", lightBg: "bg-amber-100" },
  { id: "preparing" as const, label: "Preparing", icon: ChefHat, color: "text-orange-500", bgColor: "bg-orange-500", lightBg: "bg-orange-100" },
  { id: "ready" as const, label: "Ready", icon: CheckCircle2, color: "text-emerald-500", bgColor: "bg-emerald-500", lightBg: "bg-emerald-100" },
  { id: "served" as const, label: "Served", icon: Utensils, color: "text-emerald-500", bgColor: "bg-emerald-500", lightBg: "bg-emerald-100" },
];

interface StatusTrackerProps {
  currentStatus: OrderStatus;
}

const StatusTracker: React.FC<StatusTrackerProps> = ({ currentStatus }) => {
  const currentStepIndex = STATUS_STEPS.findIndex(s => s.id === currentStatus);

  if (currentStatus === "cancelled") return null;

  return (
    <div className="relative">
      {/* Progress Bar Background */}
      <div className="absolute top-6 left-6 right-6 h-1 bg-stone-100 rounded-full -z-10"></div>
      
      {/* Active Progress Bar */}
      <div 
        className="absolute top-6 left-6 h-1 bg-emerald-500 rounded-full -z-10 transition-all duration-500 ease-in-out"
        style={{ width: `calc(${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}% - 24px)` }}
      ></div>

      <div className="flex justify-between relative z-10">
        {STATUS_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index <= currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center gap-3 w-1/4">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white shadow-sm relative overflow-hidden
                  ${isActive ? `${step.bgColor} text-white scale-110 shadow-md` : 
                    isCompleted ? 'bg-emerald-500 text-white' : 
                    'bg-stone-100 text-stone-400'}`}
              >
                <Icon className="w-5 h-5 relative z-10" />
                {isActive && step.id === 'served' && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/60 to-transparent w-[200%] h-[200%] animate-[shimmer_2s_infinite]" />
                )}
              </div>
              <span className={`text-xs sm:text-sm font-medium text-center transition-colors duration-300
                ${isActive ? step.color : isCompleted ? 'text-stone-800' : 'text-stone-400'}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTracker;
export { STATUS_STEPS };
