import React from 'react';
import { Booking } from '../../types';
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, QrCode } from 'lucide-react';

interface BookingHistoryProps {
  bookings: Booking[];
  onViewQrPass?: (booking: Booking) => void;
}

export const BookingHistory: React.FC<BookingHistoryProps> = ({
  bookings,
  onViewQrPass,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Parking Pass Logs</h3>
        <span className="text-xs text-slate-500 font-medium">{bookings.length} Total</span>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
          No parking allocations found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {bookings.map((b) => {
            const isActive = b.status === 'active';
            const isCompleted = b.status === 'completed';

            return (
              <div
                key={b.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#004B8D]">
                      Spot {b.spotCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isActive ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 font-medium">
                    {b.branchName.split('-')[0]} • {b.zoneName}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(b.startTime).toLocaleDateString()}
                    </span>
                    <span className="uppercase font-mono font-semibold text-slate-700">
                      {b.vehicleNumber}
                    </span>
                  </div>
                </div>

                {onViewQrPass && (
                  <button
                    onClick={() => onViewQrPass(b)}
                    className="p-2 bg-blue-50 text-[#004B8D] rounded-xl hover:bg-blue-100 transition-colors"
                    title="View QR Entry Token"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
