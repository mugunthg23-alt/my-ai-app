import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { User } from '../../types';
import { HdfcLogo } from '../HdfcLogo';
import { subscribeToUsers, saveUserToFirestore } from '../../lib/firebase';
import { sanitizeVehicleNumber } from '../../lib/validation';
import {
  QrCode,
  User as UserIcon,
  Phone,
  Car,
  LogOut,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Copy,
  Printer,
  Edit2,
  Save,
  ScanLine,
  Download,
  KeyRound,
  Check,
} from 'lucide-react';

interface UserQrDashboardProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  hideHeader?: boolean;
}

export const UserQrDashboard: React.FC<UserQrDashboardProps> = ({
  user,
  onLogout,
  onUpdateUser,
  hideHeader = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(`${user.firstName} ${user.lastName}`.trim());
  const [phone, setPhone] = useState(user.phone || '');
  const [vehicleNumber, setVehicleNumber] = useState(user.defaultVehicleNumber || '');

  // Helper to resolve user's unique access code
  const getUserAccessCode = (u: User): string => {
    if (u.accessCode) return u.accessCode;
    const clean = (u.email || '').toLowerCase().trim();
    if (clean === 'mugunth.g23@gmail.com') return 'ADM-2026';
    if (clean === 'security@hdfcbank.com') return 'SEC-1001';
    if (clean === 'arnav.sharma@email.com') return 'HPK-8924';
    if (clean === 'employee@hdfcbank.com') return 'HPK-1001';
    return 'HPK-1001';
  };

  const userAccessCode = getUserAccessCode(user);
  const [copiedAccessCode, setCopiedAccessCode] = useState(false);

  // QR Generation State
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrPassId, setQrPassId] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Generate QR String
  const generateUniqueQrPass = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      const uniqueNum = Math.floor(100000 + Math.random() * 900000);
      const now = new Date();
      setQrPassId(`HDFC-PASS-${uniqueNum}`);
      setGeneratedAt(
        now.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
          ' ' +
          now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      );
      setQrGenerated(true);
      setIsRegenerating(false);
    }, 400);
  };

  const formattedName = name.trim() || `${user.firstName} ${user.lastName}`.trim();
  const formattedPhone = phone.trim() || '+91 98765 43210';
  const formattedVehicle = sanitizeVehicleNumber(vehicleNumber) || 'MH02CP4821';

  const allocatedCategoryText = user.allocatedLot
    ? `${user.allocatedCategory || 'Basement on GL'} (${user.allocationType || 'Permanent'})`
    : 'Not Allocated Yet';

  // Plain text encoded inside the QR Code for universal scanning
  const qrRawText = `HDFC BANK
Name: ${formattedName}
Phone: ${formattedPhone}
Vehicle Number: ${formattedVehicle}
Unique Code: ${userAccessCode}
Allocated Category: ${allocatedCategoryText}${
    user.allocationType === 'Temporary' && user.inTime
      ? `\nIn Date & Time: ${user.inDate ? `${user.inDate} ` : ''}${user.inTime}\nOut Date & Time: ${user.outDate ? `${user.outDate} ` : ''}${user.outTime || 'Open'}`
      : ''
  }
Pass ID: ${qrPassId || 'HDFC-PASS-TEMPORARY'}`;

  // Subscribe to realtime database updates so lot allocations update instantly
  useEffect(() => {
    const unsubscribe = subscribeToUsers((allUsers) => {
      const matched = allUsers.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
      if (matched && onUpdateUser) {
        onUpdateUser(matched);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user.email]);

  const handleSaveProfile = () => {
    setIsEditing(false);
    const parts = name.trim().split(' ');
    const firstName = parts[0] || 'User';
    const lastName = parts.slice(1).join(' ') || '';

    const updated = {
      ...user,
      firstName,
      lastName,
      phone: formattedPhone,
      defaultVehicleNumber: formattedVehicle,
    };

    // Save to active session
    localStorage.setItem('hdfc_active_session', JSON.stringify(updated));

    // Update in registered users list if available
    const usersRaw = localStorage.getItem('hdfc_parking_users');
    if (usersRaw) {
      try {
        const users = JSON.parse(usersRaw);
        const idx = users.findIndex((u: any) => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx !== -1) {
          users[idx] = { ...users[idx], firstName, lastName, phone: formattedPhone, defaultVehicleNumber: formattedVehicle };
          localStorage.setItem('hdfc_parking_users', JSON.stringify(users));
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Save to Cloud Firestore
    saveUserToFirestore(updated).catch((err) => console.error('Firestore user save error:', err));

    if (onUpdateUser) {
      onUpdateUser(updated);
    }
  };

  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(userAccessCode);
    setCopiedAccessCode(true);
    setTimeout(() => setCopiedAccessCode(false), 2500);
  };

  const handleCopyScanData = () => {
    navigator.clipboard.writeText(qrRawText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadQrImage = () => {
    const canvas = document.getElementById('hdfc-user-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `HDFC_Pass_${user.firstName}_${formattedVehicle.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] min-h-full pb-6 w-full min-w-0">
      {/* Top Header Bar */}
      {!hideHeader && (
        <div className="bg-[#1d4e89] text-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-md flex items-center justify-between gap-2 sticky top-0 z-40 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-white/95 p-1 rounded-md shadow-xs flex-shrink-0">
              <HdfcLogo size="sm" variant="full" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-blue-100 font-bold whitespace-nowrap">
                RFID Pass & Gate Pass
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs flex-shrink-0 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 space-y-4 max-w-md mx-auto w-full">
        {/* Banner Title */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              User Credentials
            </span>
            <h2 className="text-sm font-black text-[#1d4e89]">
              Registered Parking Account
            </h2>
          </div>

          <button
            onClick={() => {
              if (isEditing) {
                handleSaveProfile();
              } else {
                setIsEditing(true);
              }
            }}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-md border border-gray-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-600" /> Save
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5 text-[#1d4e89]" /> Edit Details
              </>
            )}
          </button>
        </div>

        {/* User Details Card - Name, Phone, Vehicle Number & Unique Code */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="bg-[#1d4e89]/5 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-[#1d4e89] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Passholder Information
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>

          <div className="p-4 space-y-3.5">
            {/* 1. UNIQUE ACCESS CODE FIELD (PROMINENT DISPLAY & COPY) */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-xl border border-slate-800 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400/20 text-amber-300 rounded-lg border border-amber-400/30">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Unique Access Code
                  </span>
                  <p className="text-base font-mono font-black text-emerald-300 tracking-wider">
                    {userAccessCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer flex-shrink-0"
                title="Copy Unique Access Code"
              >
                {copiedAccessCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-[11px]">Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. NAME FIELD */}
            <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="p-2 bg-blue-100 text-[#1d4e89] rounded-lg">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1 bg-white border border-gray-300 rounded text-sm font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                  />
                ) : (
                  <p className="text-sm font-black text-gray-900 mt-0.5">{formattedName}</p>
                )}
              </div>
            </div>

            {/* 3. PHONE NUMBER FIELD */}
            <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="p-2 bg-blue-100 text-[#1d4e89] rounded-lg">
                <Phone className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1 bg-white border border-gray-300 rounded text-sm font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                  />
                ) : (
                  <p className="text-sm font-black text-gray-900 mt-0.5">{formattedPhone}</p>
                )}
              </div>
            </div>

            {/* 4. VEHICLE NUMBER FIELD */}
            <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="p-2 bg-red-100 text-[#e41e26] rounded-lg">
                <Car className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Vehicle Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(sanitizeVehicleNumber(e.target.value))}
                    placeholder="e.g. MH02CP4821"
                    className="w-full mt-1 px-2.5 py-1 bg-white border border-gray-300 rounded text-sm font-mono font-bold uppercase text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                  />
                ) : (
                  <p className="text-sm font-black text-[#e41e26] tracking-wider uppercase mt-0.5">
                    {formattedVehicle}
                  </p>
                )}
              </div>
            </div>

            {/* 5. ALLOCATED LOT STATUS FIELD */}
            <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200">
              <div className="p-2 bg-[#1d4e89] text-white rounded-lg shadow-xs">
                <ScanLine className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Allocated Parking Category
                  </label>
                  {user.allocatedLot ? (
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        user.allocationType === 'Permanent'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {user.allocationType} Allocation
                    </span>
                  ) : null}
                </div>

                {user.allocatedLot ? (
                  <div className="mt-0.5">
                    <p className="text-base font-black text-[#1d4e89]">
                      {user.allocatedCategory || 'Basement on GL'}
                    </p>
                    {user.allocationType === 'Temporary' && user.inTime && (
                      <p className="text-xs font-semibold text-amber-800 mt-0.5">
                        In: {user.inDate ? `${user.inDate} ` : ''}{user.inTime} | Out: {user.outDate ? `${user.outDate} ` : ''}{user.outTime || 'Open'}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-gray-400 italic mt-0.5">
                    No parking category allocated yet. Contact Admin or Security to allocate.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Generate QR Code Main Action Button */}
        {!qrGenerated ? (
          <button
            onClick={generateUniqueQrPass}
            disabled={isRegenerating}
            className="w-full py-3.5 px-4 bg-[#1d4e89] hover:bg-[#153b68] text-white font-extrabold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 uppercase tracking-wider text-xs border border-blue-900 cursor-pointer"
          >
            {isRegenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Unique Pass...
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 text-amber-300" />
                Generate Unique QR Code
              </>
            )}
          </button>
        ) : (
          /* DISPLAY GENERATED QR CODE SECTION */
          <div className="bg-white rounded-2xl border-2 border-[#1d4e89] shadow-xl p-5 text-center space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#1d4e89] uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Unique Smart QR Pass
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  Code: {userAccessCode}
                </span>
                <span className="text-[10px] font-mono font-bold bg-blue-100 text-[#1d4e89] px-2 py-0.5 rounded border border-blue-200">
                  {qrPassId}
                </span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-300 flex flex-col items-center justify-center relative">
              <div className="p-3 bg-white rounded-xl shadow-md border border-gray-200 relative group">
                <QRCodeSVG
                  value={qrRawText}
                  size={200}
                  level="M"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
                {/* Hidden canvas for high-resolution PNG export */}
                <div className="hidden">
                  <QRCodeCanvas
                    id="hdfc-user-qr-canvas"
                    value={qrRawText}
                    size={400}
                    level="M"
                    includeMargin={true}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>
              </div>

              <div className="mt-2 text-[10px] font-bold text-gray-500 flex items-center gap-1">
                <ScanLine className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Scannable by any Mobile Camera / QR Scanner
              </div>
            </div>

            {/* Verification Details Embedded in QR */}
            <div className="bg-blue-50/80 p-3 rounded-lg border border-blue-200 text-left text-xs space-y-1">
              <span className="text-[10px] font-extrabold text-[#1d4e89] uppercase tracking-wider block mb-1">
                Scanner Encoded Output:
              </span>
              <div className="font-mono text-[11px] text-gray-800 space-y-0.5 bg-white p-2 rounded border border-blue-100">
                <p>
                  <span className="font-bold text-gray-500">Name:</span> {formattedName}
                </p>
                <p>
                  <span className="font-bold text-gray-500">Phone:</span> {formattedPhone}
                </p>
                <p>
                  <span className="font-bold text-gray-500">Vehicle:</span> {formattedVehicle}
                </p>
                <p>
                  <span className="font-bold text-gray-500">Unique Code:</span> {userAccessCode}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 pt-1 border-t border-gray-100">
                  Pass ID: {qrPassId} • {generatedAt}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={generateUniqueQrPass}
                disabled={isRegenerating}
                className="py-2 px-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] border border-gray-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Regenerate Pass ID"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#1d4e89] ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQrImage}
                className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                title="Download QR Image for scanning"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </button>

              <button
                type="button"
                onClick={handleCopyScanData}
                className="py-2 px-2 bg-[#1d4e89] hover:bg-[#153b68] text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                title="Copy raw text payload"
              >
                {copiedText ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security & Verification Footer */}
        <div className="p-3 bg-white rounded-xl border border-gray-200 text-center space-y-1">
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified HDFC Bank Gate Clearance QR
          </div>
          <p className="text-[10px] text-gray-500">
            Security guards can scan this QR code directly to verify passholder identity, unique code & vehicle entry.
          </p>
        </div>
      </div>
    </div>
  );
};

