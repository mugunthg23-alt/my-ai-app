import React from 'react';
import { Booking } from '../../types';
import { Navigation, MapPin, ArrowRight, CornerUpRight, Building2, Footprints } from 'lucide-react';

interface VehicleLocatorProps {
  activeBooking?: Booking;
}

export const VehicleLocator: React.FC<VehicleLocatorProps> = ({ activeBooking }) => {
  if (!activeBooking) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
        <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
        <h4 className="text-sm font-bold text-slate-700">No Parked Vehicle Found</h4>
        <p className="text-xs text-slate-500">
          Allocate a parking spot to view step-by-step indoor walking guidance.
        </p>
      </div>
    );
  }

  const steps = [
    { title: 'Take Elevator Bank B', desc: 'Down to Basement Level 1 (B1)' },
    { title: 'Exit Lobby Doors', desc: 'Turn Left towards Pillar Row B1-Red' },
    { title: 'Walk 15 Meters', desc: 'Spot is located adjacent to Pillar B1-A04' },
    { title: 'Arrive at Vehicle', desc: `Plate: ${activeBooking.vehicleNumber}` },
  ];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <Footprints className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Find My Parked Car</h3>
            <p className="text-xs text-slate-500">Spot {activeBooking.spotCode}</p>
          </div>
        </div>
        <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-lg font-bold text-[#004B8D]">
          {activeBooking.vehicleNumber}
        </span>
      </div>

      {/* Pillar Highlight Box */}
      <div className="bg-gradient-to-r from-blue-900 to-[#004B8D] text-white p-3.5 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider block">
            Target Pillar Zone
          </span>
          <span className="text-sm font-bold">{activeBooking.pillarLocation}</span>
        </div>
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-xs">
          <Navigation className="w-5 h-5 text-emerald-300" />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3 relative pl-4 border-l-2 border-slate-200 ml-2">
        {steps.map((s, idx) => (
          <div key={idx} className="relative">
            <span className="w-3 h-3 rounded-full bg-[#004B8D] border-2 border-white absolute -left-[23px] top-1 shadow-xs" />
            <div className="text-xs font-bold text-slate-800">{s.title}</div>
            <div className="text-[11px] text-slate-500">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
