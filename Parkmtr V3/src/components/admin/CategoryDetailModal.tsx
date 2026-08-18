import React, { useState } from 'react';
import { User, ParkingCategory } from '../../types';
import {
  X,
  Layers,
  Car,
  Users,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Trash2,
  Clock,
  Search,
  Sliders,
  Sparkles,
  ShieldCheck,
  Building2,
  Building,
  Compass,
  ArrowUpDown,
} from 'lucide-react';

interface CategoryDetailModalProps {
  category: ParkingCategory;
  totalSlots: number;
  allUsers: User[];
  isSuperAdmin: boolean;
  canAllocate?: boolean;
  onClose: () => void;
  onUpdateCapacity: (category: ParkingCategory, newTotal: number) => void;
  onOpenAllocateModal: (user?: User, preselectedSlot?: number) => void;
  onReleaseLot: (userId: string) => void;
}

export const getCategoryIcon = (category: ParkingCategory, className = 'w-5 h-5') => {
  switch (category) {
    case 'Underground Basement':
      return <Building className={className} />;
    case 'Basement on GL':
      return <Building2 className={className} />;
    case 'Open':
      return <Compass className={className} />;
    case 'Visitor':
      return <Users className={className} />;
    case 'Stackup/Down':
      return <ArrowUpDown className={className} />;
    default:
      return <Layers className={className} />;
  }
};

export const getCategoryTheme = (category: ParkingCategory) => {
  switch (category) {
    case 'Underground Basement':
      return {
        bgLight: 'bg-indigo-50/70',
        border: 'border-indigo-200',
        textDark: 'text-indigo-950',
        accentBg: 'bg-indigo-600',
        badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-200',
        banner: 'from-indigo-900 to-[#002855]',
      };
    case 'Basement on GL':
      return {
        bgLight: 'bg-blue-50/70',
        border: 'border-blue-200',
        textDark: 'text-blue-950',
        accentBg: 'bg-[#1d4e89]',
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-200',
        banner: 'from-blue-900 to-[#002855]',
      };
    case 'Open':
      return {
        bgLight: 'bg-emerald-50/70',
        border: 'border-emerald-200',
        textDark: 'text-emerald-950',
        accentBg: 'bg-emerald-600',
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        banner: 'from-emerald-900 to-[#002855]',
      };
    case 'Visitor':
      return {
        bgLight: 'bg-purple-50/70',
        border: 'border-purple-200',
        textDark: 'text-purple-950',
        accentBg: 'bg-purple-600',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
        banner: 'from-purple-900 to-[#002855]',
      };
    case 'Stackup/Down':
      return {
        bgLight: 'bg-amber-50/70',
        border: 'border-amber-200',
        textDark: 'text-amber-950',
        accentBg: 'bg-amber-600',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
        banner: 'from-amber-900 to-[#002855]',
      };
    default:
      return {
        bgLight: 'bg-slate-50',
        border: 'border-slate-200',
        textDark: 'text-slate-900',
        accentBg: 'bg-[#1d4e89]',
        badgeBg: 'bg-slate-100 text-slate-900 border-slate-200',
        banner: 'from-slate-900 to-[#002855]',
      };
  }
};

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({
  category,
  totalSlots,
  allUsers,
  isSuperAdmin,
  canAllocate = true,
  onClose,
  onUpdateCapacity,
  onOpenAllocateModal,
  onReleaseLot,
}) => {
  const theme = getCategoryTheme(category);

  // Filter users allocated to this specific category
  const categoryUsers = allUsers.filter(
    (u) =>
      u.allocatedLot != null &&
      (u.allocatedCategory === category ||
        (!u.allocatedCategory && category === 'Basement on GL')) // Fallback for legacy records
  );

  const allocatedCount = categoryUsers.length;
  const freeCount = Math.max(0, totalSlots - allocatedCount);
  const occupancyPercent = totalSlots > 0 ? Math.round((allocatedCount / totalSlots) * 100) : 0;

  // State for Super Admin Capacity Setting
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacityInput, setNewCapacityInput] = useState<string>(String(totalSlots));
  const [capacityError, setCapacityError] = useState('');
  const [capacitySuccess, setCapacitySuccess] = useState('');

  // State for Slot Filtering / Searching
  const [slotFilter, setSlotFilter] = useState<'all' | 'free' | 'allocated'>('all');
  const [slotSearch, setSlotSearch] = useState('');

  // Selected slot for detail inspector
  const [selectedSlotNum, setSelectedSlotNum] = useState<number | null>(null);

  // Handle Capacity Submission by Super Admin
  const handleSaveCapacity = (e: React.FormEvent) => {
    e.preventDefault();
    setCapacityError('');
    setCapacitySuccess('');

    const num = parseInt(newCapacityInput, 10);
    if (isNaN(num) || num < 1 || num > 5000) {
      setCapacityError('Please enter a valid slot capacity between 1 and 5,000 slots.');
      return;
    }

    if (num < allocatedCount) {
      setCapacityError(
        `Cannot reduce slots to ${num} because ${allocatedCount} slots are currently occupied. Release lots first before downsizing.`
      );
      return;
    }

    onUpdateCapacity(category, num);
    setCapacitySuccess(`Successfully updated ${category} capacity to ${num} slots!`);
    setTimeout(() => {
      setIsEditingCapacity(false);
      setCapacitySuccess('');
    }, 1200);
  };

  // Build slot occupancy map (slotNumber -> User)
  const slotOccupantMap = new Map<number, User>();
  categoryUsers.forEach((u) => {
    if (u.allocatedLot) {
      slotOccupantMap.set(u.allocatedLot, u);
    }
  });

  // Generate slots array (1 to totalSlots)
  const allSlotNumbers = Array.from({ length: totalSlots }, (_, i) => i + 1);

  // Filter slots
  const filteredSlots = allSlotNumbers.filter((slotNum) => {
    const occupant = slotOccupantMap.get(slotNum);
    const isOccupied = !!occupant;

    if (slotFilter === 'free' && isOccupied) return false;
    if (slotFilter === 'allocated' && !isOccupied) return false;

    if (slotSearch.trim()) {
      const q = slotSearch.toLowerCase().trim();
      const matchesNum = String(slotNum).includes(q);
      const matchesOccupant =
        occupant &&
        (`${occupant.firstName} ${occupant.lastName}`.toLowerCase().includes(q) ||
          occupant.email.toLowerCase().includes(q) ||
          (occupant.defaultVehicleNumber || '').toLowerCase().includes(q));
      return matchesNum || matchesOccupant;
    }

    return true;
  });

  const selectedOccupant = selectedSlotNum ? slotOccupantMap.get(selectedSlotNum) : null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-auto shadow-2xl border border-gray-300 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header Banner */}
        <div className={`bg-gradient-to-r ${theme.banner} text-white p-4 sm:p-5 flex-shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 flex-shrink-0 text-white">
                {getCategoryIcon(category, 'w-6 h-6')}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-widest block">
                  Category Management
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white truncate">
                  {category}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all flex-shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metric Summary Counters */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">
                Total Slots
              </span>
              <span className="text-base sm:text-lg font-black text-white">{totalSlots}</span>
            </div>

            <div className="bg-emerald-500/20 backdrop-blur-xs p-2.5 rounded-xl border border-emerald-400/30">
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                Free Slots
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-300">{freeCount}</span>
            </div>

            <div className="bg-amber-500/20 backdrop-blur-xs p-2.5 rounded-xl border border-amber-400/30">
              <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider block">
                Allocated
              </span>
              <span className="text-base sm:text-lg font-black text-amber-300">{allocatedCount}</span>
            </div>
          </div>
        </div>

        {/* Super Admin Capacity Creator / Modifier Panel */}
        {isSuperAdmin && (
          <div className="p-3.5 bg-slate-900 text-white border-b border-slate-800 flex-shrink-0">
            {!isEditingCapacity ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-200">
                    Super Admin Control: <strong className="text-white">{totalSlots} slots</strong> configured in {category}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsEditingCapacity(true);
                    setNewCapacityInput(String(totalSlots));
                    setCapacityError('');
                    setCapacitySuccess('');
                  }}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Create / Set Slots</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveCapacity} className="space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Configure Number of Slots for "{category}"
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingCapacity(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={newCapacityInput}
                      onChange={(e) => setNewCapacityInput(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full pl-3 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg shadow-sm transition-all cursor-pointer flex-shrink-0"
                  >
                    Submit & Create Slots
                  </button>
                </div>

                {capacityError && (
                  <p className="text-[11px] text-red-400 font-semibold">{capacityError}</p>
                )}
                {capacitySuccess && (
                  <p className="text-[11px] text-emerald-400 font-bold">{capacitySuccess}</p>
                )}
              </form>
            )}
          </div>
        )}

        {/* Selected Slot Quick Inspector / Action Banner */}
        {selectedSlotNum && (
          <div className="p-3 bg-blue-50 border-b border-blue-200 flex-shrink-0 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 bg-[#1d4e89] text-white font-black text-xs rounded-md">
                  Slot #{selectedSlotNum}
                </span>
                {selectedOccupant ? (
                  <div className="text-xs text-gray-800 truncate">
                    <strong className="text-gray-900">{selectedOccupant.firstName} {selectedOccupant.lastName}</strong>
                    <span className="text-gray-500 font-mono ml-1.5">({selectedOccupant.defaultVehicleNumber || 'N/A'})</span>
                    <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                      {selectedOccupant.allocationType}
                    </span>
                    {selectedOccupant.allocationType === 'Temporary' && selectedOccupant.inTime && (
                      <span className="text-[10px] text-amber-900 font-semibold ml-1.5">
                        In: {selectedOccupant.inDate ? `${selectedOccupant.inDate} ` : ''}{selectedOccupant.inTime}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Vacant & Available
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedOccupant ? (
                  canAllocate && (
                    <button
                      onClick={() => {
                        onReleaseLot(selectedOccupant.id);
                        setSelectedSlotNum(null);
                      }}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Release Slot
                    </button>
                  )
                ) : (
                  canAllocate && (
                    <button
                      onClick={() => {
                        onOpenAllocateModal(undefined, selectedSlotNum);
                        setSelectedSlotNum(null);
                      }}
                      className="px-2.5 py-1 bg-[#1d4e89] hover:bg-[#153b68] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Allocate Slot #{selectedSlotNum}
                    </button>
                  )
                )}
                <button
                  onClick={() => setSelectedSlotNum(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slot Browser Controls & Filter */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all' as const, label: `All (${totalSlots})` },
              { id: 'free' as const, label: `Free (${freeCount})` },
              { id: 'allocated' as const, label: `Allocated (${allocatedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSlotFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  slotFilter === tab.id
                    ? 'bg-[#1d4e89] text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box & Allocate action (Allocate shown only if canAllocate) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-44">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={slotSearch}
                onChange={(e) => setSlotSearch(e.target.value)}
                placeholder="Search slot or user..."
                className="w-full pl-8 pr-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-[#1d4e89]"
              />
            </div>

            {canAllocate && (
              <button
                onClick={() => onOpenAllocateModal(undefined, undefined)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer flex-shrink-0"
                title="Allocate a slot in this category to any registered user"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Allocate Slot</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Slots Grid (Scrollable) */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {filteredSlots.map((slotNum) => {
              const occupant = slotOccupantMap.get(slotNum);
              const isOccupied = !!occupant;
              const isSelected = selectedSlotNum === slotNum;

              return (
                <button
                  key={slotNum}
                  onClick={() => setSelectedSlotNum(slotNum === selectedSlotNum ? null : slotNum)}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-between cursor-pointer relative group ${
                    isSelected
                      ? 'ring-2 ring-[#1d4e89] border-[#1d4e89] bg-blue-100 shadow-md'
                      : isOccupied
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100 text-amber-950 shadow-2xs'
                      : 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100 text-emerald-950 shadow-2xs'
                  }`}
                  title={
                    isOccupied
                      ? `Slot #${slotNum} - Occupied by ${occupant?.firstName} ${occupant?.lastName} (${occupant?.defaultVehicleNumber || 'N/A'})`
                      : `Slot #${slotNum} - Free / Available (Click to allocate)`
                  }
                >
                  <span className="text-[10px] font-black text-gray-400 block mb-0.5">
                    #{slotNum}
                  </span>

                  <div className="my-0.5">
                    {isOccupied ? (
                      <Car className="w-4 h-4 text-amber-700" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>

                  <span
                    className={`text-[9px] font-extrabold px-1 py-0.2 rounded-full uppercase tracking-tighter block truncate max-w-full ${
                      isOccupied
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {isOccupied ? 'Occupied' : 'Free'}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredSlots.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-xs">
              No slots found matching your filter or search criteria.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-600 font-medium">
            Category: <strong className="text-gray-900">{category}</strong> ({freeCount} of {totalSlots} slots free)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-lg transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
