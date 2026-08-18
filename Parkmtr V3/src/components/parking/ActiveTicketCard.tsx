import React, { useState, useEffect } from 'react';
import { Booking } from '../../types';
import { Clock, MapPin, QrCode, Navigation, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface ActiveTicketCardProps {
  booking: Booking;
  onRelease: (bookingId: string) => void;
  onExtend: (bookingId: string) => void;
  onNavigateToSpot?: () => void;
}

export const ActiveTicketCard: React.FC<ActiveTicketCardProps> = ({
  booking,
  onRelease,
  onExtend,
  onNavigateToSpot,
}) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(booking.endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`
      );
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [booking.endTime]);

  return (
    <div className="bg-gradient-to-br from-[#003366] to-[#004B8D] text-white rounded-2xl p-4 shadow-xl border border-blue-800/40 relative overflow-hidden">
      {/* Background Subtle Accent Pattern */}
      <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />

      {/* Top Pass Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Active Parking Pass
          </span>
        </div>
        <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-blue-200">
          ID: #{booking.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* Main Spot Spotlight Display */}
      <div className="my-4 flex items-center justify-between bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
        <div>
          <span className="text-[10px] text-blue-200 uppercase font-bold tracking-widest block mb-0.5">
            Allocated Spot
          </span>
          <div className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            {booking.spotCode}
            <span className="text-xs font-medium text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Reserved
            </span>
          </div>
          <span className="text-xs text-blue-100 font-medium mt-1 block">
            {booking.zoneName}
          </span>
        </div>

        {/* QR Code Action Button */}
        <button
          onClick={() => setShowQrModal(true)}
          className="bg-white p-2.5 rounded-xl shadow-md hover:bg-blue-50 transition-all flex flex-col items-center gap-1 group"
        >
          <QrCode className="w-7 h-7 text-[#004B8D] group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-bold text-[#004B8D] uppercase tracking-wider">
            Scan Pass
          </span>
        </button>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="bg-black/20 p-2.5 rounded-lg border border-white/5">
          <span className="text-[10px] text-blue-200 block mb-0.5 font-medium">
            Vehicle License Plate
          </span>
          <span className="font-bold text-white tracking-wide uppercase">
            {booking.vehicleNumber}
          </span>
        </div>

        <div className="bg-black/20 p-2.5 rounded-lg border border-white/5">
          <span className="text-[10px] text-blue-200 block mb-0.5 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-300" /> Time Remaining
          </span>
          <span className="font-bold text-amber-300 font-mono tracking-wide">
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Pillar Guidance */}
      <div className="bg-blue-950/40 p-2.5 rounded-lg border border-blue-800/40 flex items-start gap-2 mb-4 text-xs text-blue-100">
        <MapPin className="w-4 h-4 text-[#EE2A24] flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block">Pillar Location & Navigation:</span>
          <span className="text-slate-300 text-[11px]">{booking.pillarLocation}</span>
        </div>
      </div>

      {/* Pass Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onRelease(booking.id)}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Release Spot
        </button>

        <button
          onClick={() => onExtend(booking.id)}
          className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 backdrop-blur-md"
        >
          <Clock className="w-3.5 h-3.5" />
          Extend (+1 Hr)
        </button>

        {onNavigateToSpot && (
          <button
            onClick={onNavigateToSpot}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center justify-center shadow-sm"
            title="Navigate to Vehicle"
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* QR Code Full Pass Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl relative">
            <h3 className="font-extrabold text-base text-[#003366]">HDFC Parking Entry Pass</h3>
            <p className="text-xs text-slate-500 mb-4">Scan at HDFC Security Boom Barrier</p>

            {/* Mock High-Res QR Code */}
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 inline-block mb-4 shadow-inner">
              <div className="w-40 h-40 bg-slate-900 rounded-xl p-2 flex flex-col items-center justify-center relative overflow-hidden">
                <QrCode className="w-36 h-36 text-white" />
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-red-500/10 pointer-events-none" />
              </div>
            </div>

            <div className="text-xs space-y-1 bg-slate-100 p-2.5 rounded-xl font-mono text-slate-700 mb-4">
              <div>Spot: <strong className="text-[#004B8D]">{booking.spotCode}</strong></div>
              <div>Plate: <strong>{booking.vehicleNumber}</strong></div>
              <div>Token: <span className="text-slate-500">{booking.qrCode}</span></div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-[#004B8D] text-white font-bold rounded-xl text-xs hover:bg-[#003366]"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
