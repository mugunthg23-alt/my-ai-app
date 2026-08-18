import React from 'react';

interface HdfcLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'emblem' | 'banner';
  className?: string;
}

export const HdfcLogo: React.FC<HdfcLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
}) => {
  const sizeMap = {
    sm: { banner: 'px-2.5 py-1', text: 'text-xs md:text-sm', emblem: 'w-4 h-4', tagline: 'text-[9px]' },
    md: { banner: 'px-3.5 py-1.5', text: 'text-sm md:text-base', emblem: 'w-5 h-5', tagline: 'text-[11px]' },
    lg: { banner: 'px-5 py-2.5', text: 'text-lg md:text-xl', emblem: 'w-7 h-7', tagline: 'text-xs md:text-sm' },
    xl: { banner: 'px-7 py-3.5', text: 'text-2xl md:text-3xl', emblem: 'w-9 h-9', tagline: 'text-sm md:text-base' },
  };

  const currentSize = sizeMap[size];

  // The Iconic HDFC Emblem SVG
  const EmblemSvg = () => (
    <svg
      viewBox="0 0 100 100"
      className={`${currentSize.emblem} flex-shrink-0 drop-shadow-2xs`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" fill="#EE2A24" />
      <path d="M 28 0 H 72 V 100 H 28 Z M 0 28 H 100 V 72 H 0 Z" fill="#FFFFFF" />
      <rect x="0" y="0" width="28" height="28" fill="#EE2A24" />
      <rect x="72" y="0" width="28" height="28" fill="#EE2A24" />
      <rect x="0" y="72" width="28" height="28" fill="#EE2A24" />
      <rect x="72" y="72" width="28" height="28" fill="#EE2A24" />
      <rect x="36" y="36" width="28" height="28" fill="#004B8D" />
    </svg>
  );

  if (variant === 'emblem') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <EmblemSvg />
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      {/* Dark Blue Horizontal Container matching attached reference image */}
      <div className={`bg-[#004B8D] ${currentSize.banner} flex items-center justify-center gap-2.5 shadow-md rounded-xs border border-blue-900/30`}>
        <EmblemSvg />
        <span className={`text-white font-extrabold tracking-wider uppercase font-sans ${currentSize.text} leading-none`}>
          HDFC BANK
        </span>
      </div>

      {/* Official Tagline below */}
      <span className={`text-gray-800 font-normal tracking-tight mt-1 font-sans ${currentSize.tagline}`}>
        We understand your world
      </span>
    </div>
  );
};
