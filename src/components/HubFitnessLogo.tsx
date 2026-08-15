import React from 'react';

interface HubFitnessLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
  /** Only the hexagon mark — useful in dense chrome (report modals, toolbars). */
  iconOnly?: boolean;
}

export const HubFitnessLogo: React.FC<HubFitnessLogoProps> = ({
  size = 'md',
  variant = 'dark',
  showSubtitle = true,
  iconOnly = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const isDarkBg = variant === 'dark'; // Dark navy sidebar background

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Geometric Hexagon Pulse Icon Badge */}
      <div
        className={`${iconSizes[size]} relative flex items-center justify-center rounded-lg shadow-md transition-transform hover:scale-105 shrink-0 ${
          isDarkBg
            ? 'bg-linear-to-br from-[#1F3864] via-[#2A487D] to-[#0F1C32] border border-white/20'
            : 'bg-linear-to-br from-[#1F3864] to-[#006100] border border-gray-200'
        }`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Hexagonal Frame */}
          <path
            d="M20 4L33.8564 12V28L20 36L6.14359 28V12L20 4Z"
            stroke={isDarkBg ? '#C6EFCE' : '#FFFFFF'}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Stylized 'H' and Fitness Pulse Line */}
          <path
            d="M13 14V26M27 14V26M13 20H27"
            stroke={isDarkBg ? '#FFFFFF' : '#C6EFCE'}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M10 20L15 20L18 15L22 25L25 20L30 20"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!iconOnly && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight font-sans ${titleSizes[size]} ${
                isDarkBg ? 'text-white' : 'text-[#1F3864]'
              }`}
            >
              HUB<span className="text-[#10B981]">-FITNESS</span>
            </span>
            <span className="text-[9px] font-extrabold uppercase bg-[#006100] text-white px-1 py-0.5 rounded tracking-widest">
              3PL
            </span>
          </div>
          {showSubtitle && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                isDarkBg ? 'text-gray-300' : 'text-gray-500'
              }`}
            >
              Logistics & Financial Planner
            </span>
          )}
        </div>
      )}
    </div>
  );
};
