import React, { useState } from 'react';
import { ParkingZone, ParkingSpot, SpotType } from '../../types';
import { Zap, Accessibility, ShieldCheck, Check, Filter, Info, ChevronRight, Car } from 'lucide-react';

interface ParkingMapProps {
  zones: ParkingZone[];
  spots: ParkingSpot[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  onAllocateSpot: (spot: ParkingSpot) => void;
}

export const ParkingMap: React.FC<ParkingMapProps> = ({
  zones,
  spots,
  selectedZoneId,
  onSelectZone,
  onAllocateSpot,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedSpotModal, setSelectedSpotModal] = useState<ParkingSpot | null>(null);

  const activeZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  // Filter spots for the current zone
  const filteredSpots = spots.filter((spot) => {
    if (spot.floorId !== selectedZoneId) return false;
    if (filterType === 'available') return spot.status === 'available';
    if (filterType === 'ev') return spot.hasEvCharger;
    if (filterType === 'executive') return spot.type === 'Executive';
    if (filterType === 'elevator') return spot.nearElevator;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Zone Floor Selector Pills */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          return (
            <button
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-semibold text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                isSelected
                  ? 'bg-[#004B8D] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
              }`}
            >
              <span>{zone.name.split('(')[0]}</span>
              <span
                className={`text-[10px] font-normal ${
                  isSelected ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {zone.availableSpots} spots free
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between text-xs overflow-x-auto no-scrollbar py-0.5 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 pl-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Available' },
            { id: 'ev', label: '⚡ EV Chargers' },
            { id: 'executive', label: '⭐ Executive' },
            { id: 'elevator', label: '🛗 Near Elevator' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterType === f.id
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & Key */}
      <div className="bg-slate-900 text-white p-3 rounded-xl text-[11px] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Available
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Occupied
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Reserved
          </div>
        </div>
        <span className="text-slate-400 font-mono text-[10px]">
          Zone: {activeZone?.code}
        </span>
      </div>

      {/* Interactive Parking Grid Layout */}
      <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md relative overflow-hidden">
        {/* Drive Lane Marker */}
        <div className="w-full bg-slate-700/60 py-1 mb-3 rounded-lg flex items-center justify-between px-3 text-[10px] text-slate-300 font-mono tracking-widest border border-dashed border-slate-600">
          <span>◀ ENTRANCE GATE</span>
          <span>MAIN DRIVEWAY LANE 🚘</span>
          <span>ELEVATOR LOBBY B ▶</span>
        </div>

        {/* Spot Grid Cards */}
        <div className="grid grid-cols-4 gap-2.5">
          {filteredSpots.map((spot) => {
            const isAvailable = spot.status === 'available';
            const isOccupied = spot.status === 'occupied';
            const isReserved = spot.status === 'reserved';

            let bgColor = 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-600/30';
            let badgeText = 'FREE';

            if (isOccupied) {
              bgColor = 'bg-rose-950/40 border-rose-800/40 text-rose-300 opacity-70 cursor-not-allowed';
              badgeText = 'BUSY';
            } else if (isReserved) {
              bgColor = 'bg-amber-950/40 border-amber-700/50 text-amber-300 cursor-not-allowed';
              badgeText = 'HELD';
            }

            return (
              <button
                key={spot.id}
                disabled={!isAvailable}
                onClick={() => setSelectedSpotModal(spot)}
                className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-between transition-all duration-200 min-h-[76px] relative group ${bgColor} ${
                  spot.hasEvCharger ? 'ring-2 ring-cyan-400/40' : ''
                }`}
              >
                {/* Spot Header Code */}
                <div className="flex items-center justify-between w-full">
                  <span className="font-extrabold text-xs font-mono tracking-wider">
                    {spot.code}
                  </span>
                  {spot.hasEvCharger && (
                    <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400 animate-pulse" />
                  )}
                  {spot.type === 'Accessible' && (
                    <Accessibility className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </div>

                {/* Status Indicator Icon */}
                <div className="my-1">
                  {isAvailable ? (
                    <Car className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                      ✕
                    </div>
                  )}
                </div>

                {/* Footer Tag */}
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/30">
                  {badgeText}
                </span>
              </button>
            );
          })}
        </div>

        {filteredSpots.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-xs">
            No spots match the selected filter. Try choosing "All".
          </div>
        )}
      </div>

      {/* Spot Details Modal for Allocation */}
      {selectedSpotModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#004B8D] uppercase tracking-wider">
                  Select Parking Slot
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Spot {selectedSpotModal.code}
                </h3>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                Available
              </span>
            </div>

            {/* Features List */}
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span>Floor & Zone:</span>
                <strong className="text-slate-800">{activeZone.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Spot Type:</span>
                <strong className="text-[#004B8D]">{selectedSpotModal.type}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>EV Fast Charger:</span>
                <strong className={selectedSpotModal.hasEvCharger ? 'text-emerald-600' : 'text-slate-400'}>
                  {selectedSpotModal.hasEvCharger ? 'Yes (Type 2 Ready)' : 'No'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Near Elevator Bank:</span>
                <strong className={selectedSpotModal.nearElevator ? 'text-blue-600' : 'text-slate-500'}>
                  {selectedSpotModal.nearElevator ? 'Yes (< 15 meters)' : 'Standard Walk'}
                </strong>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSelectedSpotModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const spotToBook = selectedSpotModal;
                  setSelectedSpotModal(null);
                  onAllocateSpot(spotToBook);
                }}
                className="flex-2 py-3 bg-[#004B8D] hover:bg-[#003366] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                Allocate Spot {selectedSpotModal.code}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
