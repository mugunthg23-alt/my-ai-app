import React, { useState } from 'react';
import { User } from '../../types';
import { HdfcLogo } from '../HdfcLogo';
import { User as UserIcon, Mail, Phone, ShieldCheck, LogOut, Car, BadgeCheck, KeyRound, Copy, Check } from 'lucide-react';

interface UserProfileProps {
  user: User;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout }) => {
  const [copied, setCopied] = useState(false);

  const getCode = () => {
    if (user.accessCode) return user.accessCode;
    const clean = (user.email || '').toLowerCase();
    if (clean === 'mugunth.g23@gmail.com') return 'ADM-2026';
    if (clean === 'security@hdfcbank.com') return 'SEC-1001';
    if (clean === 'arnav.sharma@email.com') return 'HPK-8924';
    return 'HPK-1001';
  };

  const code = getCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="space-y-4">
      {/* Profile Card Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-[#004B8D] text-white flex items-center justify-center font-extrabold text-xl shadow-md border-2 border-white flex-shrink-0">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {user.firstName} {user.lastName}
            </h2>
            <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
          </div>
          <span className="inline-block px-2 py-0.5 bg-blue-50 text-[#004B8D] font-bold text-[10px] rounded-md border border-blue-100">
            {user.role} • {user.employeeId || 'HDFC Staff'}
          </span>
        </div>
      </div>

      {/* User Registered Information Details */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">
          Registered Details
        </h3>

        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" /> Email ID
          </span>
          <span className="font-semibold text-slate-800">{user.email}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" /> Login Access Code
          </span>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
            <span className="font-mono font-black text-emerald-800 text-xs tracking-wider select-all">
              {code}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 hover:bg-emerald-200/60 rounded text-emerald-800 transition-colors cursor-pointer"
              title="Copy Access Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" /> Phone Number
          </span>
          <span className="font-semibold text-slate-800">{user.phone}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 flex items-center gap-2">
            <Car className="w-4 h-4 text-slate-400" /> Primary License Plate
          </span>
          <span className="font-bold text-slate-900 uppercase font-mono">
            {user.defaultVehicleNumber || 'MH 02 CP 4821'}
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Security Status
          </span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            Verified Active
          </span>
        </div>
      </div>

      {/* HDFC Bank Branding Banner */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center">
        <HdfcLogo size="sm" variant="banner" />
      </div>

      {/* Logout Action Button */}
      <button
        onClick={onLogout}
        className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
};
