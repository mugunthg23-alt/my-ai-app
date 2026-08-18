import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { User } from '../../types';
import { getUserDocId, generateUniqueAccessCode } from '../../lib/firebase';
import { sanitizeVehicleNumber, getVehicleNumberValidationError } from '../../lib/validation';
import {
  ShieldCheck,
  Shield,
  UserPlus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Crown,
  KeyRound,
  Trash2,
  Mail,
  Phone,
  Car,
  User as UserIcon,
  RefreshCw,
  Sparkles,
  X,
  Layers,
  Copy,
  Download,
  Check,
} from 'lucide-react';

interface RoleManagementProps {
  allUsers: User[];
  currentAdmin: User;
  onUpdateUserRole: (userId: string, newRole: User['role'], makeAdmin: boolean) => void;
  onAddNewUserWithRole: (newUser: User) => void;
  onDeleteUser: (userId: string) => void;
  isSyncing: boolean;
  onSync: () => void;
}

export const RoleManagement: React.FC<RoleManagementProps> = ({
  allUsers,
  currentAdmin,
  onUpdateUserRole,
  onAddNewUserWithRole,
  onDeleteUser,
  isSyncing,
  onSync,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Admin Super User' | 'Employee - FTE' | 'Security'>('all');

  // Modal: Add New User Under Role
  const [showAddModal, setShowAddModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<User['role']>('Employee - FTE');
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [copiedCodeMap, setCopiedCodeMap] = useState<Record<string, boolean>>({});

  // Toast feedback
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Helper to resolve user's code
  const getUserAccessCode = (u: User): string => {
    if (u.accessCode) return u.accessCode;
    const clean = (u.email || '').toLowerCase().trim();
    if (clean === 'mugunth.g23@gmail.com') return 'ADM-2026';
    if (clean === 'security@hdfcbank.com') return 'SEC-1001';
    if (clean === 'arnav.sharma@email.com') return 'HPK-8924';
    if (clean === 'employee@hdfcbank.com') return 'HPK-1001';
    return 'HPK-1001';
  };

  // Role Statistics
  const adminSuperUserCount = allUsers.filter(
    (u) => u.isAdmin || u.role === 'Admin Super User' || u.role === 'Admin' || u.email.toLowerCase() === 'mugunth.g23@gmail.com'
  ).length;
  const securityCount = allUsers.filter((u) => u.role === 'Security').length;
  const employeeFteCount = allUsers.filter(
    (u) => u.role === 'Employee - FTE' || u.role === 'Employee' || u.role === 'Executive' || u.role === 'Visitor' || (!u.role && !u.isAdmin)
  ).length;

  // Filtered Users List
  const filteredUsers = allUsers.filter((u) => {
    const query = searchTerm.toLowerCase();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = u.email.toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const empId = (u.employeeId || '').toLowerCase();
    const roleStr = (u.role || '').toLowerCase();
    const code = (u.accessCode || '').toLowerCase();

    const matchesSearch =
      fullName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      empId.includes(query) ||
      roleStr.includes(query) ||
      code.includes(query);

    if (!matchesSearch) return false;

    if (roleFilter === 'Admin Super User') {
      return u.isAdmin || u.role === 'Admin Super User' || u.role === 'Admin' || u.email.toLowerCase() === 'mugunth.g23@gmail.com';
    }
    if (roleFilter === 'Security') {
      return u.role === 'Security';
    }
    if (roleFilter === 'Employee - FTE') {
      return u.role === 'Employee - FTE' || u.role === 'Employee' || u.role === 'Executive' || u.role === 'Visitor' || (!u.role && !u.isAdmin);
    }

    return true;
  });

  const handleRoleChange = (userId: string, targetRole: User['role']) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    if (!targetUser) return;

    if (targetUser.email.toLowerCase() === 'mugunth.g23@gmail.com') {
      alert('The Root Administrator (mugunth.g23@gmail.com) role is protected and cannot be changed.');
      return;
    }

    const makeAdmin = targetRole === 'Admin Super User';
    onUpdateUserRole(userId, targetRole, makeAdmin);

    setActionToast(
      `Updated ${targetUser.firstName} ${targetUser.lastName}'s role to "${targetRole}"${
        makeAdmin ? ' with full Admin Super User privileges' : targetRole === 'Security' ? ' with Security gate & timing permissions' : ''
      }.`
    );
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleToggleAdminStatus = (user: User) => {
    if (user.email.toLowerCase() === 'mugunth.g23@gmail.com') {
      alert('Root Administrator status is permanent.');
      return;
    }

    const currentIsAdmin = user.isAdmin || user.role === 'Admin Super User' || user.role === 'Admin';
    const nextRole: User['role'] = currentIsAdmin ? 'Employee - FTE' : 'Admin Super User';
    const nextIsAdmin = !currentIsAdmin;

    onUpdateUserRole(user.id, nextRole, nextIsAdmin);

    setActionToast(
      `${nextIsAdmin ? 'Promoted' : 'Demoted'} ${user.firstName} ${user.lastName} ${
        nextIsAdmin ? 'to Admin Super User' : 'to Employee - FTE'
      }.`
    );
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleCopyCode = (userId: string, code: string, userName: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeMap((prev) => ({ ...prev, [userId]: true }));
    setActionToast(`Copied Access Code "${code}" for ${userName} to clipboard!`);
    setTimeout(() => {
      setCopiedCodeMap((prev) => ({ ...prev, [userId]: false }));
      setActionToast(null);
    }, 3000);
  };

  // Export User Access Codes to Excel
  const handleExportAccessCodes = () => {
    const exportData = allUsers.map((u, idx) => ({
      '#': idx + 1,
      'First Name': u.firstName || '',
      'Last Name': u.lastName || '',
      'Email ID': u.email || '',
      'Unique Access Code': getUserAccessCode(u),
      'Role': u.role || 'Employee - FTE',
      'Vehicle Number': u.defaultVehicleNumber || '',
      'Phone Number': u.phone || '',
      'Allocated Lot': u.allocatedLot != null ? u.allocatedLot : 'None',
      'Allocation Type': u.allocationType || 'None',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 18 },
      { wch: 32 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User_Access_Codes');
    XLSX.writeFile(workbook, `HDFC_User_Access_Codes_${new Date().toISOString().slice(0, 10)}.xlsx`);

    setActionToast(`Exported ${allUsers.length} user access codes to Excel!`);
    setTimeout(() => setActionToast(null), 3500);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAddError('Please enter a valid Email ID.');
      return;
    }

    if (!newFirstName.trim() || !newLastName.trim()) {
      setAddError('First Name and Last Name are required.');
      return;
    }

    if (!newPhone.trim()) {
      setAddError('Phone Number is required.');
      return;
    }

    const cleanVehicle = sanitizeVehicleNumber(newVehicleNumber);
    const vehError = getVehicleNumberValidationError(cleanVehicle, true);
    if (vehError) {
      setAddError(vehError);
      return;
    }

    // Check duplicate email
    const existing = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      setAddError(`User with email "${cleanEmail}" is already registered. You can change their role in the list below.`);
      return;
    }

    const isGivenAdmin = newRole === 'Admin Super User';

    const generatedCode = generateUniqueAccessCode(
      isGivenAdmin ? 'ADM' : newRole === 'Security' ? 'SEC' : 'HPK'
    );

    const newUserObj: User = {
      id: getUserDocId(cleanEmail),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      email: cleanEmail,
      phone: newPhone.trim(),
      accessCode: generatedCode,
      role: newRole,
      isAdmin: isGivenAdmin,
      password: 'Welcome@123',
      defaultVehicleNumber: cleanVehicle,
      allocatedLot: null,
      allocationType: null,
      registeredAt: new Date().toISOString(),
    };

    onAddNewUserWithRole(newUserObj);
    setAddSuccess(
      `User ${newUserObj.firstName} ${newUserObj.lastName} created! Unique Access Code: "${generatedCode}".`
    );

    setTimeout(() => {
      setShowAddModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('Employee - FTE');
      setNewVehicleNumber('');
      setAddError('');
      setAddSuccess('');
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* Module Banner */}
      <div className="bg-gradient-to-r from-[#002855] via-[#1d4e89] to-[#002855] text-white p-4 rounded-2xl shadow-md border border-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-400/20 text-amber-300 border border-amber-300/30 rounded-xl shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wide uppercase">
                Role & Unique Access Code Directory
              </h2>
              <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-400/30">
                🔒 Password-Free
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-1 max-w-2xl leading-relaxed">
              Every user is assigned a unique access code for password-free login. Only Admins can view and copy all access codes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleExportAccessCodes}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download Excel sheet of all users and their unique access codes"
          >
            <Download className="w-4 h-4" />
            <span>Export Access Codes (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewRole('Employee - FTE');
              setAddError('');
              setAddSuccess('');
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>+ Add User</span>
          </button>

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/20 cursor-pointer"
            title="Sync role directory with Firestore cloud database"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-300' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Toast */}
      {actionToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs ml-2 font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Root Administrator Card (mugunth.g23@gmail.com) */}
      <div className="bg-white rounded-2xl p-4 border-2 border-amber-300 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-xl flex items-center justify-center font-black shadow-md border border-amber-300">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">Mugunth G</span>
                <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[9px] rounded-full uppercase flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-200" /> Admin Super User
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                  Permanent Root
                </span>
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
                  <KeyRound className="w-3 h-3 text-amber-700" />
                  <span className="text-[10px] font-bold text-amber-900 uppercase">Access Code:</span>
                  <span className="font-mono text-xs font-black text-amber-950">ADM-2026</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode('root_admin', 'ADM-2026', 'Mugunth G')}
                    className="p-0.5 hover:bg-amber-200 rounded text-amber-900 cursor-pointer ml-1"
                    title="Copy Access Code"
                  >
                    {copiedCodeMap['root_admin'] ? (
                      <Check className="w-3 h-3 text-emerald-700" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap font-mono">
                <span className="flex items-center gap-1 text-[#1d4e89] font-bold">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> mugunth.g23@gmail.com
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> +91 98765 43210
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-700">
                  ID: HDFC-ADMIN-01
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Access Level</span>
              <span className="text-xs font-black text-red-600">Full Access (Everything)</span>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800" title="Protected System Account">
              <Lock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Role Counts Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setRoleFilter(roleFilter === 'Admin Super User' ? 'all' : 'Admin Super User')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'Admin Super User'
              ? 'bg-red-50 border-red-400 shadow-sm ring-2 ring-red-300'
              : 'bg-white border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800">
              Admin Super Users
            </span>
            <Crown className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black text-red-900">{adminSuperUserCount}</span>
            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
              Full Access
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter(roleFilter === 'Security' ? 'all' : 'Security')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'Security'
              ? 'bg-amber-50 border-amber-400 shadow-sm ring-2 ring-amber-300'
              : 'bg-white border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
              Security Personnel
            </span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-900">{securityCount}</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Release & Timings
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter(roleFilter === 'Employee - FTE' ? 'all' : 'Employee - FTE')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'Employee - FTE'
              ? 'bg-blue-50 border-blue-400 shadow-sm ring-2 ring-blue-300'
              : 'bg-white border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
              Employees - FTE
            </span>
            <UserIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black text-blue-900">{employeeFteCount}</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              Self View Only
            </span>
          </div>
        </button>
      </div>

      {/* User Directory & Role Assignment Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Panel Header & Controls */}
        <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-xs font-black text-[#1d4e89] uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#e41e26]" />
              User Matrix & Access Code Directory ({filteredUsers.length})
            </h3>
            <p className="text-[11px] text-gray-500">
              Each user's unique login access code is visible below for Admin reference.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, access code..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#1d4e89]"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3.5 py-2 bg-slate-50/50 border-b border-gray-200 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Filter:</span>
          {[
            { id: 'all', label: `All Users (${allUsers.length})` },
            { id: 'Admin Super User', label: `Admin Super Users (${adminSuperUserCount})` },
            { id: 'Security', label: `Security (${securityCount})` },
            { id: 'Employee - FTE', label: `Employees - FTE (${employeeFteCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-[#1d4e89] text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Items List */}
        <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <UserIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-700">No users found matching your search.</p>
              <p className="text-[11px] text-gray-400 mt-1">Try adjusting the filter or search keywords.</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isRootAdmin = u.email.toLowerCase() === 'mugunth.g23@gmail.com';
              const isAdmin = u.isAdmin || u.role === 'Admin Super User' || u.role === 'Admin';
              const isSecurity = u.role === 'Security';
              const accessCode = getUserAccessCode(u);

              return (
                <div
                  key={u.id}
                  className={`p-3.5 transition-colors ${
                    isRootAdmin
                      ? 'bg-amber-50/30'
                      : isAdmin
                      ? 'bg-red-50/20 hover:bg-red-50/40'
                      : isSecurity
                      ? 'bg-amber-50/20 hover:bg-amber-50/40'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* User Profile Details */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-2xs ${
                          isRootAdmin
                            ? 'bg-amber-500 text-slate-950 border border-amber-400'
                            : isAdmin
                            ? 'bg-red-600 text-white'
                            : isSecurity
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-blue-100 text-[#1d4e89]'
                        }`}
                      >
                        {isRootAdmin ? (
                          <Crown className="w-5 h-5" />
                        ) : isAdmin ? (
                          <Crown className="w-4 h-4" />
                        ) : isSecurity ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || 'U'
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-gray-900">
                            {u.firstName} {u.lastName}
                          </span>

                          {/* Role Badge */}
                          {isRootAdmin ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[9px] rounded-full uppercase flex items-center gap-1 shadow-2xs">
                              <Crown className="w-2.5 h-2.5 text-amber-200" /> Admin Super User (Root)
                            </span>
                          ) : isAdmin ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[9px] rounded-full uppercase flex items-center gap-1 shadow-2xs">
                              <Crown className="w-2.5 h-2.5" /> Admin Super User
                            </span>
                          ) : isSecurity ? (
                            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase flex items-center gap-1 shadow-2xs">
                              <Shield className="w-2.5 h-2.5" /> Security
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded border border-blue-200">
                              Employee - FTE
                            </span>
                          )}

                          {/* Unique Access Code Pill with 1-Click Copy */}
                          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                            <KeyRound className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                            <span className="text-[9px] font-bold text-emerald-900 uppercase">Code:</span>
                            <span className="font-mono text-xs font-black text-emerald-800 tracking-wider select-all">
                              {accessCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(u.id, accessCode, `${u.firstName} ${u.lastName}`)}
                              className="p-0.5 hover:bg-emerald-200/60 rounded text-emerald-800 transition-colors cursor-pointer ml-0.5"
                              title="Copy Access Code"
                            >
                              {copiedCodeMap[u.id] ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 font-mono mt-0.5 flex-wrap">
                          <span className="text-gray-700">{u.email}</span>
                          <span>•</span>
                          <span>{u.phone || '+91 98765 00000'}</span>
                          <span>•</span>
                          <span className="text-[#e41e26] font-bold">
                            Vehicle: {u.defaultVehicleNumber || 'N/A'}
                          </span>
                          <span>•</span>
                          {u.allocatedCategory || u.allocatedLot != null ? (
                            <span className="text-blue-900 font-sans font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px] inline-flex items-center gap-1">
                              <Layers className="w-3 h-3 text-[#1d4e89]" />
                              Category: {u.allocatedCategory || 'Basement on GL'} ({u.allocationType || 'Permanent'})
                            </span>
                          ) : (
                            <span className="text-gray-400 font-sans italic text-[11px]">
                              Category: Not Allocated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Role Select */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      {isRootAdmin ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-lg border border-amber-300 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> Root Owner
                        </span>
                      ) : (
                        <>
                          {/* Role Selector Dropdown */}
                          <div className="relative">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as User['role'])}
                              className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89] shadow-2xs cursor-pointer"
                            >
                              <option value="Admin Super User">Admin Super User (Full Access)</option>
                              <option value="Security">Security (View All, Release & Timings)</option>
                              <option value="Employee - FTE">Employee - FTE (View Own Only)</option>
                            </select>
                          </div>

                          {/* Quick Admin Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAdminStatus(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer ${
                              isAdmin
                                ? 'bg-red-100 hover:bg-red-200 text-red-950 border border-red-300'
                                : 'bg-[#1d4e89] hover:bg-[#153b68] text-white'
                            }`}
                            title={isAdmin ? 'Revoke Admin Super User' : 'Make Admin Super User'}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>{isAdmin ? 'Super User' : 'Grant Super User'}</span>
                          </button>

                          {/* Delete option */}
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove user account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: ADD USER UNDER ROLE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-300 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    Access & Roles
                  </span>
                  <h3 className="text-base font-black text-[#1d4e89]">
                    Add New User (Password-Free)
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error & Success Messages */}
            {addError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 font-bold">
                {addError}
              </div>
            )}
            {addSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                {addSuccess}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Role *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { role: 'Admin Super User' as const, label: 'Admin Super User', desc: 'Full access for everything', icon: Crown, highlight: 'red' },
                    { role: 'Security' as const, label: 'Security', desc: 'View all, release, timings', icon: Shield, highlight: 'amber' },
                    { role: 'Employee - FTE' as const, label: 'Employee - FTE', desc: 'View only own records', icon: UserIcon, highlight: 'blue' },
                  ].map((r) => {
                    const Icon = r.icon;
                    const isSelected = newRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setNewRole(r.role)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? r.highlight === 'red'
                              ? 'bg-red-600 text-white border-red-700 font-bold shadow-xs'
                              : r.highlight === 'amber'
                              ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-xs'
                              : 'bg-[#1d4e89] text-white border-[#1d4e89] font-bold shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs font-bold">{r.label}</span>
                        </div>
                        <span className={`text-[10px] ${isSelected ? 'opacity-90' : 'text-gray-500'}`}>
                          {r.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Verma"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. rahul.verma@hdfcbank.com"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Vehicle Number (Mandatory) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase">
                    Vehicle Number *
                  </label>
                  <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                    Alphanumeric
                  </span>
                </div>
                <input
                  type="text"
                  value={newVehicleNumber}
                  onChange={(e) => setNewVehicleNumber(sanitizeVehicleNumber(e.target.value))}
                  placeholder="e.g. MH02CD9988"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white uppercase font-mono"
                  required
                />
                <p className="text-[9px] text-gray-500 mt-0.5">Mandatory. No spaces or special characters.</p>
              </div>

              {/* Automatic Code Notice */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Unique Login Access Code:</span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    A unique code (e.g. <span className="font-mono font-bold">HPK-XXXX</span>) will be automatically generated upon creation and will appear immediately in your Admin User List.
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#1d4e89] hover:bg-[#153b68] text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Generate Code & Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-300 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Delete User Account</h3>
                <p className="text-[11px] text-slate-500">Are you sure you want to remove this user?</p>
              </div>
            </div>

            <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-red-900">{userToDelete.firstName} {userToDelete.lastName}</div>
              <div className="text-slate-600 font-mono text-[11px]">{userToDelete.email}</div>
              <div className="text-slate-500 text-[11px]">Role: <span className="font-bold text-slate-700">{userToDelete.role}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = userToDelete.id;
                  const name = `${userToDelete.firstName} ${userToDelete.lastName}`;
                  onDeleteUser(id);
                  setUserToDelete(null);
                  setActionToast(`Successfully deleted user "${name}".`);
                  setTimeout(() => setActionToast(null), 4000);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
