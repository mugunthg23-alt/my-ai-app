import React, { useState } from 'react';
import { User, ParkingSpot, Booking } from '../../types';
import { Car, Zap, Clock, ShieldCheck, Sparkles, Check, ChevronRight } from 'lucide-react';

interface AutoAllocateModalProps {
  user: User;
  spots: ParkingSpot[];
  activeBranchName: string;
  onConfirmAllocation: (newBooking: Booking) => void;
  onClose: () => void;
}

export const AutoAllocateModal: React.FC<AutoAllocateModalProps> = ({
  user,
  spots,
  activeBranchName,
  onConfirmAllocation,
  onClose,
}) => {
  const [vehicleNumber, setVehicleNumber] = useState(
    user.defaultVehicleNumber || 'MH 02 CP 4821'
  );
  const [vehicleType, setVehicleType] = useState<'Sedan' | 'SUV' | 'Hatchback' | 'Two-Wheeler' | 'EV'>('Sedan');
  const [durationHours, setDurationHours] = useState<number>(4);
  const [requiresEv, setRequiresEv] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  const handleSmartAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) return;

    setIsAllocating(true);

    setTimeout(() => {
      setIsAllocating(false);

      // Find best available spot
      let availableSpots = spots.filter((s) => s.status === 'available');
      if (requiresEv || vehicleType === 'EV') {
        const evSpots = availableSpots.filter((s) => s.hasEvCharger);
        if (evSpots.length > 0) availableSpots = evSpots;
      }

      const selectedSpot =
        availableSpots.find((s) => s.nearElevator) ||
        availableSpots[0] || {
          id: 'spot_b1_auto',
          code: 'B1-A08',
          type: 'Standard',
          status: 'available',
        };

      const now = new Date();
      const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      const newBooking: Booking = {
        id: `bk_${Date.now()}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        spotId: selectedSpot.id,
        spotCode: selectedSpot.code,
        zoneName: selectedSpot.code.startsWith('B1')
          ? 'Basement 1 (Executive)'
          : 'Basement 2 (Staff)',
        floorName: 'Level -1',
        branchName: activeBranchName,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        status: 'active',
        qrCode: `HDFC-PASS-${Math.floor(100000 + Math.random() * 900000)}`,
        pillarLocation: `Pillar ${selectedSpot.code.slice(0, 2)}-${selectedSpot.code.slice(-2)} near Elevator B`,
      };

      onConfirmAllocation(newBooking);
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white text-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-[#004B8D] rounded-xl">
              <Sparkles className="w-5 h-5 text-[#EE2A24]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Smart Auto-Allocate
              </h3>
              <p className="text-[11px] text-slate-500">Instant nearest slot finder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSmartAllocate} className="space-y-3.5">
          {/* License Plate Number */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Vehicle License Plate *
            </label>
            <div className="relative">
              <Car className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MH 02 CP 4821"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tracking-wide uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                required
              />
            </div>
          </div>

          {/* Vehicle Type Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Vehicle Category
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Sedan', 'SUV', 'Hatchback', 'Two-Wheeler', 'EV'] as const).map((vt) => (
                <button
                  key={vt}
                  type="button"
                  onClick={() => {
                    setVehicleType(vt);
                    if (vt === 'EV') setRequiresEv(true);
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                    vehicleType === vt
                      ? 'bg-[#004B8D] text-white border-[#004B8D] shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {vt}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Parking Duration
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { hours: 1, label: '1 Hour (Quick)' },
                { hours: 4, label: '4 Hours (Half Day)' },
                { hours: 8, label: '8 Hours (Full Shift)' },
              ].map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setDurationHours(d.hours)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                    durationHours === d.hours
                      ? 'bg-[#EE2A24] text-white border-[#EE2A24] shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* EV Charging Switch */}
          <div className="bg-cyan-50 p-3 rounded-2xl border border-cyan-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-600 fill-cyan-600" />
              <div>
                <span className="text-xs font-bold text-cyan-900 block">Require EV Fast Charger</span>
                <span className="text-[10px] text-cyan-700">Allocates EV Charging Bay</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={requiresEv}
              onChange={(e) => setRequiresEv(e.target.checked)}
              className="w-4 h-4 text-[#004B8D] rounded border-slate-300 focus:ring-2 focus:ring-[#004B8D]"
            />
          </div>

          {/* Submit Auto Allocate */}
          <button
            type="submit"
            disabled={isAllocating}
            className="w-full py-3.5 bg-[#004B8D] hover:bg-[#003366] text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {isAllocating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Confirm & Allocate Best Spot
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
