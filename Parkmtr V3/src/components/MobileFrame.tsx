import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTabTitle?: string;
  userEmail?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] text-slate-900 flex flex-col items-center justify-start font-sans antialiased">
      <main className="w-full min-h-screen flex flex-col bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] relative shadow-sm">
        <div className="flex-1 w-full min-w-0 bg-transparent text-slate-900 flex flex-col relative">
          {children}
        </div>
      </main>
    </div>
  );
};

