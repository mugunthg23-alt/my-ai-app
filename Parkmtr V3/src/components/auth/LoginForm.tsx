import React, { useState } from 'react';
import { HdfcLogo } from '../HdfcLogo';
import {
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (email: string) => void;
  onNavigateRegister: () => void;
  prefillEmail?: string;
  registrationSuccessMsg?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  prefillEmail = '',
  registrationSuccessMsg = '',
}) => {
  const [email, setEmail] = useState(prefillEmail || '');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Helper: Get registered users from localStorage or default list
  const getRegisteredUsers = (): any[] => {
    const registeredUsersRaw = localStorage.getItem('hdfc_parking_users');
    let registeredUsers: any[] = [];
    if (registeredUsersRaw) {
      try {
        registeredUsers = JSON.parse(registeredUsersRaw);
      } catch (err) {
        console.error('Error parsing registered users:', err);
      }
    }

    // Ensure root admin exists with unique access code
    const adminIdx = registeredUsers.findIndex(
      (u) => u.email && u.email.toLowerCase() === 'mugunth.g23@gmail.com'
    );
    if (adminIdx === -1) {
      registeredUsers.push({
        id: 'usr_admin_1',
        firstName: 'Mugunth',
        lastName: 'G',
        email: 'mugunth.g23@gmail.com',
        phone: '+91 98765 43210',
        accessCode: 'ADM-2026',
        role: 'Admin Super User',
        isAdmin: true,
        defaultVehicleNumber: 'ADMIN01',
        employeeId: 'HDFC-ADMIN-01',
      });
    } else if (!registeredUsers[adminIdx].accessCode) {
      registeredUsers[adminIdx].accessCode = 'ADM-2026';
    }

    // Ensure security desk user exists
    const secIdx = registeredUsers.findIndex(
      (u) => u.email && u.email.toLowerCase() === 'security@hdfcbank.com'
    );
    if (secIdx === -1) {
      registeredUsers.push({
        id: 'usr_sec_1',
        firstName: 'Security',
        lastName: 'Desk',
        email: 'security@hdfcbank.com',
        phone: '+91 98765 11223',
        accessCode: 'SEC-1001',
        role: 'Security',
        isAdmin: false,
        defaultVehicleNumber: 'SECPATROL01',
        employeeId: 'HDFC-SEC-01',
      });
    } else if (!registeredUsers[secIdx].accessCode) {
      registeredUsers[secIdx].accessCode = 'SEC-1001';
    }

    // Ensure demo employee users exist
    const demoIdx = registeredUsers.findIndex(
      (u) => u.email && u.email.toLowerCase() === 'arnav.sharma@email.com'
    );
    if (demoIdx === -1) {
      registeredUsers.push({
        id: 'usr_demo_1',
        firstName: 'Arnav',
        lastName: 'Sharma',
        email: 'arnav.sharma@email.com',
        phone: '+91 98765 43210',
        accessCode: 'HPK-8924',
        role: 'Employee - FTE',
        defaultVehicleNumber: 'MH02CP4821',
        employeeId: 'HDFC-89241',
      });
    } else if (!registeredUsers[demoIdx].accessCode) {
      registeredUsers[demoIdx].accessCode = 'HPK-8924';
    }

    const demo3Idx = registeredUsers.findIndex(
      (u) => u.email && u.email.toLowerCase() === 'employee@hdfcbank.com'
    );
    if (demo3Idx === -1) {
      registeredUsers.push({
        id: 'usr_demo_3',
        firstName: 'HDFC',
        lastName: 'Employee',
        email: 'employee@hdfcbank.com',
        phone: '+91 98765 00000',
        accessCode: 'HPK-1001',
        role: 'Employee - FTE',
        defaultVehicleNumber: 'MH01AB1234',
        employeeId: 'HDFC-10001',
      });
    } else if (!registeredUsers[demo3Idx].accessCode) {
      registeredUsers[demo3Idx].accessCode = 'HPK-1001';
    }

    localStorage.setItem('hdfc_parking_users', JSON.stringify(registeredUsers));
    return registeredUsers;
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsRegistration(false);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = accessCode.trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Email id.');
      return;
    }

    if (!cleanCode) {
      setError('Please enter your Unique Access Code.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const registeredUsers = getRegisteredUsers();
      const foundUser = registeredUsers.find(
        (u) => u.email && u.email.toLowerCase() === cleanEmail
      );

      // Check 1: User existence
      if (!foundUser) {
        setNeedsRegistration(true);
        setError(`Email ID "${cleanEmail}" is not registered. Please register first or contact your Administrator.`);
        return;
      }

      // Check 2: Unique Access Code match
      let expectedCode = (foundUser.accessCode || '').trim().toUpperCase();
      if (!expectedCode) {
        if (cleanEmail === 'mugunth.g23@gmail.com') expectedCode = 'ADM-2026';
        else if (cleanEmail === 'security@hdfcbank.com') expectedCode = 'SEC-1001';
        else if (cleanEmail === 'arnav.sharma@email.com') expectedCode = 'HPK-8924';
        else if (cleanEmail === 'employee@hdfcbank.com') expectedCode = 'HPK-1001';
        else expectedCode = 'HPK-1001';
      }

      // Normalize comparison (ignore dashes or spaces if entered)
      const normalizedEntered = cleanCode.replace(/[^A-Z0-9]/g, '');
      const normalizedExpected = expectedCode.replace(/[^A-Z0-9]/g, '');

      if (
        cleanCode !== expectedCode &&
        normalizedEntered !== normalizedExpected &&
        cleanCode !== 'ADM-2026' // Allow root override for admin testing
      ) {
        setError(
          `Invalid Access Code for ${cleanEmail}! Please check the unique code provided by the Admin.`
        );
        return;
      }

      // Login Successful
      onLoginSuccess(foundUser.email);
    }, 450);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 sm:p-6 bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] text-slate-800 min-h-full relative overflow-hidden">
      {/* Background Decorative Subtle Accents */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & HDFC Logo */}
      <div className="pt-2 flex flex-col items-center text-center relative z-10">
        <div className="transform hover:scale-105 transition-transform duration-300 bg-white p-3.5 rounded-2xl shadow-xl border border-white/20">
          <HdfcLogo size="lg" variant="full" />
        </div>
        <div className="mt-3 flex items-center justify-center bg-white/10 backdrop-blur-xs px-4 py-1 rounded-full border border-white/20">
          <span className="text-sm font-black text-white tracking-widest font-sans">
            Ｐａｒｋमि𝘵𝘳
          </span>
        </div>
      </div>

      {/* Main Login Form Card */}
      <div className="relative z-10 my-auto py-2 max-w-md mx-auto w-full">
        {/* Registration Toast Feedback */}
        {registrationSuccessMsg && (
          <div className="mb-3 p-3.5 bg-emerald-950/80 border border-emerald-400/40 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200 shadow-md backdrop-blur-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block text-emerald-100">Registration Completed!</span>
              <p className="mt-0.5">{registrationSuccessMsg}</p>
            </div>
          </div>
        )}

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-blue-900/40 shadow-2xl space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 shadow-sm animate-in fade-in space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="font-medium">{error}</div>
              </div>
              {needsRegistration && (
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Click Here to Register Your Account
                </button>
              )}
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email id
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setNeedsRegistration(false);
                  }}
                  placeholder="e.g. employee@hdfcbank.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] transition-all shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Unique Access Code Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Unique Access Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="e.g. HPK-1001 or ADM-2026"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#004B8D] focus:ring-1 focus:ring-[#004B8D] uppercase transition-all shadow-2xs"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#004B8D] inline flex-shrink-0" />
                Contact Admin for the Unique code
              </p>
            </div>

            {/* Submit Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#004B8D] hover:bg-[#00386b] disabled:bg-slate-300 text-white font-extrabold rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 group uppercase text-xs tracking-wider cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Verify Access Code & Login
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer / Register Navigation Link */}
      <div className="pt-3 pb-1 text-center border-t border-white/15 relative z-10 mt-auto">
        <p className="text-xs text-blue-200 font-medium">
          New User / Employee without an account?{' '}
          <button
            type="button"
            onClick={onNavigateRegister}
            className="text-amber-300 font-bold underline hover:text-white cursor-pointer ml-1"
          >
            Register to Get Access Code
          </button>
        </p>
      </div>
    </div>
  );
};
