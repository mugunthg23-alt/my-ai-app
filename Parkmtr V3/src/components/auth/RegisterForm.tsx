import React, { useState } from 'react';
import { HdfcLogo } from '../HdfcLogo';
import {
  Mail,
  User as UserIcon,
  Phone,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Car,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { saveUserToFirestore, generateUniqueAccessCode } from '../../lib/firebase';
import { sanitizeVehicleNumber, getVehicleNumberValidationError } from '../../lib/validation';
import { User } from '../../types';

interface RegisterFormProps {
  onRegisterSuccess: (email: string, firstName: string) => void;
  onNavigateLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [role, setRole] = useState<'Employee - FTE' | 'Security'>('Employee - FTE');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Success State with Generated Code
  const [generatedUser, setGeneratedUser] = useState<User | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Field Validation
    if (!firstName.trim()) {
      setError('Please enter your First Name.');
      return;
    }

    if (!lastName.trim()) {
      setError('Please enter your Last Name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid Email ID.');
      return;
    }

    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      setError('Please enter a valid Phone Number.');
      return;
    }

    // Vehicle Number Alphanumeric Validation (Mandatory, no spaces or special characters)
    const vehError = getVehicleNumberValidationError(vehicleNumber, true);
    if (vehError) {
      setError(vehError);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);

      const cleanVehicle = sanitizeVehicleNumber(vehicleNumber) || 'MH02CP4821';
      const cleanEmail = email.trim().toLowerCase();
      const newAccessCode = generateUniqueAccessCode('HPK');

      // Create new user object
      const newUser: User = {
        id: `usr_${Date.now()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        accessCode: newAccessCode,
        role: role,
        defaultVehicleNumber: cleanVehicle,
        employeeId: `HDFC-${Math.floor(10000 + Math.random() * 90000)}`,
        registeredAt: new Date().toISOString(),
      };

      // Retrieve existing registered users from localStorage
      const existingRaw = localStorage.getItem('hdfc_parking_users');
      let users: any[] = [];
      if (existingRaw) {
        try {
          users = JSON.parse(existingRaw);
        } catch (err) {
          console.error(err);
        }
      }

      // Check if email already registered
      if (users.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase())) {
        setError('An account with this Email ID already exists. Please log in with your access code.');
        return;
      }

      // Save to localStorage
      users.push(newUser);
      localStorage.setItem('hdfc_parking_users', JSON.stringify(users));

      // Save to Cloud Firestore for multi-device sync
      saveUserToFirestore(newUser).catch((err) => console.error('Firestore user save failed:', err));

      // Show generated code screen
      setGeneratedUser(newUser);
    }, 500);
  };

  const handleCopyCode = () => {
    if (!generatedUser?.accessCode) return;
    navigator.clipboard.writeText(generatedUser.accessCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleProceedToLogin = () => {
    if (generatedUser) {
      onRegisterSuccess(
        generatedUser.email,
        `Your Unique Login Access Code is "${generatedUser.accessCode}". You can also view it in the Admin panel.`
      );
    } else {
      onNavigateLogin();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 md:p-6 bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] text-slate-800 min-h-full relative overflow-hidden">
      {/* Decorative Subtle Background Accents */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10">
        <button
          type="button"
          onClick={onNavigateLogin}
          className="flex items-center gap-1 text-xs font-bold text-blue-200 hover:text-white transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
        </button>

        <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-3">
          <div>
            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight">
              Ｐａｒｋमि𝘵𝘳 Registration
            </h2>
            <p className="text-xs text-blue-200 font-medium mt-0.5">
              Smart Parking & Allocation Pass
            </p>
          </div>
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-white/20">
            <HdfcLogo size="sm" variant="full" />
          </div>
        </div>
      </div>

      {/* SUCCESS SCREEN WITH GENERATED ACCESS CODE */}
      {generatedUser ? (
        <div className="relative z-10 my-auto bg-white p-5 md:p-6 rounded-2xl border border-emerald-200 shadow-xl space-y-4 max-w-md mx-auto w-full animate-in zoom-in-95">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-base font-black text-slate-900 uppercase">
              Registration Completed!
            </h3>
            <p className="text-xs text-slate-600">
              Welcome, <strong className="text-slate-900">{generatedUser.firstName} {generatedUser.lastName}</strong>!
            </p>
          </div>

          {/* Unique Access Code Display Box */}
          <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Your Unique Login Access Code
            </span>
            <div className="text-2xl font-black font-mono tracking-widest text-emerald-400 py-1 select-all">
              {generatedUser.accessCode}
            </div>
            <p className="text-[11px] text-slate-300">
              Use your email (<span className="text-white font-medium">{generatedUser.email}</span>) and this code to log in. No passwords required!
            </p>

            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-lg transition-all border border-emerald-500/30 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Access Code
                </>
              )}
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Your unique access code has been securely saved and is also visible to the HDFC Facility Admin.
            </span>
          </div>

          <button
            type="button"
            onClick={handleProceedToLogin}
            className="w-full py-3 px-4 bg-[#004B8D] hover:bg-[#00386b] text-white font-extrabold rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 group uppercase text-xs tracking-wider cursor-pointer"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      ) : (
        <>
          {/* Validation Error Banner */}
          {error && (
            <div className="relative z-10 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium text-center shadow-sm">
              {error}
            </div>
          )}

          {/* Registration Form Container */}
          <form
            onSubmit={handleSubmit}
            className="relative z-10 space-y-3 my-auto bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xl max-w-md mx-auto w-full"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
              <KeyRound className="w-4 h-4 text-[#004B8D]" />
              <span>Password-Free: A unique code will be assigned automatically.</span>
            </div>

            {/* Name Fields (First & Last Name) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Arnav"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-colors shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-colors shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Email ID */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Corporate Email ID *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. arnav.sharma@email.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-colors shadow-2xs"
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <div className="flex">
                <span className="bg-slate-100 px-3 py-2 rounded-l-lg text-sm font-semibold text-slate-700 border border-r-0 border-slate-300 flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-r-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-colors shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Vehicle License Plate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Vehicle License Plate *
                </label>
                <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  Alphanumeric only
                </span>
              </div>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(sanitizeVehicleNumber(e.target.value))}
                placeholder="e.g. MH02CP4821 (no spaces)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm uppercase text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-colors shadow-2xs font-mono font-medium"
                required
              />
            </div>

            {/* Category / Role */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Role / Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Employee - FTE' as const, label: 'Employee - FTE' },
                  { id: 'Security' as const, label: 'Security' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                      role === r.id
                        ? 'bg-[#004B8D] text-white border-[#004B8D] shadow-xs'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Register Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3 px-4 bg-[#004B8D] hover:bg-[#00386b] text-white font-extrabold rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wider cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Generate Access Code & Register
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="pt-3 text-center border-t border-white/15 relative z-10">
            <p className="text-xs text-blue-200 font-medium">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-amber-300 font-bold underline hover:text-white cursor-pointer ml-1"
              >
                Login with Access Code
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
};
