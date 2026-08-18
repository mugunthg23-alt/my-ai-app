import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { User } from '../../types';
import { getUserDocId, generateUniqueAccessCode } from '../../lib/firebase';
import { sanitizeVehicleNumber, getVehicleNumberValidationError } from '../../lib/validation';
import {
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Sparkles,
  Car,
  Mail,
  User as UserIcon,
  Shield,
  ShieldCheck,
  Check,
  RefreshCw,
  Eye,
  Trash2,
  HelpCircle,
  KeyRound,
  Copy,
} from 'lucide-react';

interface ParsedUserRow {
  index: number;
  firstName: string;
  lastName: string;
  email: string;
  vehicleNumber: string;
  role: User['role'];
  accessCode: string;
  status: 'valid' | 'duplicate_system' | 'duplicate_file' | 'invalid_email' | 'invalid_vehicle' | 'missing_fields';
  errorMessage?: string;
}

interface CreateAndBulkUploadUsersProps {
  allUsers: User[];
  currentAdmin: User;
  onAddNewUser: (newUser: User) => void;
  onBulkAddUsers: (newUsers: User[]) => void;
  onClose?: () => void;
}

export const CreateAndBulkUploadUsers: React.FC<CreateAndBulkUploadUsersProps> = ({
  allUsers,
  currentAdmin,
  onAddNewUser,
  onBulkAddUsers,
  onClose,
}) => {
  // Mode: 'single' (Create User) or 'bulk' (Upload Excel)
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // ================= SINGLE USER CREATION STATE =================
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [role, setRole] = useState<User['role']>('Employee - FTE');
  const [singleError, setSingleError] = useState('');
  const [singleSuccess, setSingleSuccess] = useState('');

  // ================= BULK UPLOAD STATE =================
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  // -------------------------------------------------------------
  // 1. SINGLE USER CREATION HANDLER
  // -------------------------------------------------------------
  const handleSingleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError('');
    setSingleSuccess('');

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanVehicle = sanitizeVehicleNumber(vehicleNumber);

    if (!cleanFirstName) {
      setSingleError('Please enter First Name.');
      return;
    }
    if (!cleanLastName) {
      setSingleError('Please enter Last Name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setSingleError('Please enter a valid Email ID (e.g. employee@hdfcbank.com).');
      return;
    }
    
    // Validate vehicle number (alphanumeric only, no spaces or special characters)
    const vehError = getVehicleNumberValidationError(cleanVehicle, true);
    if (vehError) {
      setSingleError(vehError);
      return;
    }

    // Check duplicate email
    const existing = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      setSingleError(`User with Email ID "${cleanEmail}" is already registered in the system.`);
      return;
    }

    const isGivenAdmin = role === 'Admin Super User' || role === 'Admin';
    const cleanDocId = getUserDocId(cleanEmail);
    const newAccessCode = generateUniqueAccessCode(isGivenAdmin ? 'ADM' : role === 'Security' ? 'SEC' : 'HPK');
    const newUserObj: User = {
      id: cleanDocId,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: cleanEmail,
      phone: '+91 98765 00000',
      accessCode: newAccessCode,
      defaultVehicleNumber: cleanVehicle,
      role: role,
      isAdmin: isGivenAdmin,
      password: 'Welcome@123',
      employeeId: `HDFC-${Math.floor(10000 + Math.random() * 90000)}`,
      allocatedLot: null,
      allocationType: null,
      registeredAt: new Date().toISOString(),
    };

    onAddNewUser(newUserObj);
    setSingleSuccess(
      `User ${cleanFirstName} ${cleanLastName} (${cleanEmail}) created with Unique Access Code "${newAccessCode}" (Role: ${role})!`
    );

    // Reset Form
    setFirstName('');
    setLastName('');
    setEmail('');
    setVehicleNumber('');
    setRole('Employee - FTE');
  };

  // -------------------------------------------------------------
  // 2. DOWNLOAD EXCEL SAMPLE TEMPLATE (.xlsx)
  // -------------------------------------------------------------
  const handleDownloadTemplate = () => {
    // Exact requested columns for 3-role system (alphanumeric vehicle numbers, no spaces/symbols)
    const templateHeaders = [
      {
        'First Name': 'Rajesh',
        'Last Name': 'Kumar',
        'Email ID': 'rajesh.kumar@hdfcbank.com',
        'Vehicle Number': 'MH02CP4821',
        'Role': 'Employee - FTE',
      },
      {
        'First Name': 'Priya',
        'Last Name': 'Sharma',
        'Email ID': 'priya.sharma@hdfcbank.com',
        'Vehicle Number': 'DL01AB9988',
        'Role': 'Security',
      },
      {
        'First Name': 'Suresh',
        'Last Name': 'Menon',
        'Email ID': 'suresh.menon@hdfcbank.com',
        'Vehicle Number': 'MH12XY7711',
        'Role': 'Admin Super User',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateHeaders);

    // Set standard column widths for clean viewing in Excel
    worksheet['!cols'] = [
      { wch: 18 }, // First Name
      { wch: 18 }, // Last Name
      { wch: 32 }, // Email ID
      { wch: 22 }, // Vehicle Number
      { wch: 20 }, // Role
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User_Upload_Template');

    XLSX.writeFile(workbook, 'HDFC_User_Bulk_Upload_Template.xlsx');
  };

  // -------------------------------------------------------------
  // 3. PARSE EXCEL FILE ON UPLOAD
  // -------------------------------------------------------------
  const parseExcelFile = (file: File) => {
    setSelectedFile(file);
    setBulkError('');
    setBulkSuccess('');
    setIsProcessingFile(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          setBulkError('The uploaded Excel file contains no data rows. Please fill the template and re-upload.');
          setIsProcessingFile(false);
          setParsedRows([]);
          return;
        }

        const seenEmailsInFile = new Set<string>();
        const processedRows: ParsedUserRow[] = [];

        jsonRows.forEach((row, idx) => {
          // Flexible key lookup tolerant of lowercase/trim/spacing variations
          let rowFirstName = '';
          let rowLastName = '';
          let rowEmail = '';
          let rowVehicle = '';
          let rowRoleStr = '';

          Object.keys(row).forEach((key) => {
            const normalizedKey = key.trim().toLowerCase().replace(/[_\s-]+/g, '');
            const val = String(row[key]).trim();

            if (normalizedKey === 'firstname' || normalizedKey === 'first') {
              rowFirstName = val;
            } else if (normalizedKey === 'lastname' || normalizedKey === 'last') {
              rowLastName = val;
            } else if (
              normalizedKey === 'emailid' ||
              normalizedKey === 'email' ||
              normalizedKey === 'emailaddress'
            ) {
              rowEmail = val.toLowerCase();
            } else if (
              normalizedKey === 'vehiclenumber' ||
              normalizedKey === 'vechicalnumber' ||
              normalizedKey === 'vehicle' ||
              normalizedKey === 'plate' ||
              normalizedKey === 'plateno'
            ) {
              rowVehicle = val.toUpperCase();
            } else if (normalizedKey === 'role' || normalizedKey === 'userrole') {
              rowRoleStr = val;
            }
          });

          // Normalize Role strictly to the 3-role model
          let normalizedRole: User['role'] = 'Employee - FTE';
          const lowerRole = rowRoleStr.toLowerCase();
          if (lowerRole.includes('admin') || lowerRole.includes('super')) {
            normalizedRole = 'Admin Super User';
          } else if (lowerRole.includes('sec') || lowerRole.includes('guard')) {
            normalizedRole = 'Security';
          } else {
            normalizedRole = 'Employee - FTE';
          }

          // Validation
          let rowStatus: ParsedUserRow['status'] = 'valid';
          let errorMsg = '';
          const cleanVehicle = sanitizeVehicleNumber(rowVehicle);

          if (!rowFirstName || !rowLastName || !rowEmail || !cleanVehicle) {
            rowStatus = 'missing_fields';
            errorMsg = 'Missing one or more required fields (First Name, Last Name, Email, or Vehicle Number).';
          } else if (!rowEmail.includes('@') || !rowEmail.includes('.')) {
            rowStatus = 'invalid_email';
            errorMsg = 'Invalid Email ID format.';
          } else if (cleanVehicle.length < 2 || cleanVehicle.length > 16) {
            rowStatus = 'invalid_vehicle';
            errorMsg = 'Vehicle number must be 2-16 alphanumeric characters (no spaces or special characters).';
          } else if (allUsers.some((u) => u.email.toLowerCase() === rowEmail)) {
            rowStatus = 'duplicate_system';
            errorMsg = 'Email ID is already registered in the system database.';
          } else if (seenEmailsInFile.has(rowEmail)) {
            rowStatus = 'duplicate_file';
            errorMsg = 'Duplicate Email ID within this Excel upload file.';
          } else {
            seenEmailsInFile.add(rowEmail);
          }

          const generatedAccessCode = generateUniqueAccessCode(
            normalizedRole === 'Admin Super User' ? 'ADM' : normalizedRole === 'Security' ? 'SEC' : 'HPK'
          );

          processedRows.push({
            index: idx + 1,
            firstName: rowFirstName,
            lastName: rowLastName,
            email: rowEmail,
            vehicleNumber: cleanVehicle,
            role: normalizedRole,
            accessCode: generatedAccessCode,
            status: rowStatus,
            errorMessage: errorMsg,
          });
        });

        setParsedRows(processedRows);
        setIsProcessingFile(false);
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setBulkError('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
        setIsProcessingFile(false);
        setParsedRows([]);
      }
    };

    reader.onerror = () => {
      setBulkError('Could not read the uploaded file. Please try again.');
      setIsProcessingFile(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  // -------------------------------------------------------------
  // 4. CONFIRM BULK IMPORT
  // -------------------------------------------------------------
  const validRows = parsedRows.filter((r) => r.status === 'valid');
  const invalidRowsCount = parsedRows.length - validRows.length;

  const handleConfirmBulkUpload = () => {
    if (validRows.length === 0) {
      setBulkError('No valid user records found to import.');
      return;
    }

    const newUsersToCreate: User[] = validRows.map((r) => {
      const cleanEmail = r.email.toLowerCase().trim();
      const isAdminRole = r.role === 'Admin Super User' || r.role === 'Admin';
      return {
        id: getUserDocId(cleanEmail),
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        email: cleanEmail,
        phone: '+91 98765 00000',
        accessCode: r.accessCode || generateUniqueAccessCode('HPK'),
        defaultVehicleNumber: r.vehicleNumber.trim().toUpperCase(),
        role: r.role,
        isAdmin: isAdminRole,
        password: 'Welcome@123',
        employeeId: `HDFC-${Math.floor(10000 + Math.random() * 90000)}`,
        allocatedLot: null,
        allocationType: null,
        registeredAt: new Date().toISOString(),
      };
    });

    onBulkAddUsers(newUsersToCreate);

    setBulkSuccess(
      `Successfully uploaded and created ${newUsersToCreate.length} user${
        newUsersToCreate.length === 1 ? '' : 's'
      } in bulk from Excel!`
    );

    // Reset Excel View
    setTimeout(() => {
      setSelectedFile(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 2500);
  };

  const handleClearExcel = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setBulkError('');
    setBulkSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-[#002855] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-white/10 rounded-xl">
            <UserPlus className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider">
                Create & Upload Users
              </h2>
              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-blue-200">
              Create individual users or upload employees & visitors in bulk via Excel (.xlsx)
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/80 px-4 pt-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('single');
            setSingleError('');
            setSingleSuccess('');
          }}
          className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'single'
              ? 'border-[#1d4e89] text-[#1d4e89]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Individual User</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('bulk');
            setBulkError('');
            setBulkSuccess('');
          }}
          className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'bulk'
              ? 'border-[#1d4e89] text-[#1d4e89]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Bulk Upload via Excel (.xlsx)</span>
        </button>
      </div>

      {/* TAB 1: CREATE INDIVIDUAL USER */}
      {activeTab === 'single' && (
        <form onSubmit={handleSingleCreateSubmit} className="p-5 space-y-4">
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Input user details to register account with a Unique Access Code.</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                A unique login code (e.g. <strong className="font-mono font-bold">HPK-XXXX</strong>, <strong className="font-mono font-bold">SEC-XXXX</strong>, or <strong className="font-mono font-bold">ADM-XXXX</strong>) will be generated automatically for instant, password-free login.
              </p>
            </div>
          </div>

          {singleError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{singleError}</span>
            </div>
          )}

          {singleSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{singleSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* First Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rajesh"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1d4e89]"
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Kumar"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1d4e89]"
                />
              </div>
            </div>

            {/* Email ID */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Email ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rajesh.kumar@hdfcbank.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1d4e89]"
                />
              </div>
            </div>

            {/* Vehicle Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  Alphanumeric only
                </span>
              </div>
              <div className="relative">
                <Car className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(sanitizeVehicleNumber(e.target.value))}
                  placeholder="e.g. MH02CP4821 (no spaces)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono font-medium uppercase tracking-wider focus:bg-white focus:outline-none focus:border-[#1d4e89]"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Only letters and digits allowed. No spaces, dashes, or special characters.
              </p>
            </div>

            {/* Role */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { role: 'Admin Super User' as const, label: 'Admin Super User', desc: 'Full access for everything', icon: ShieldCheck, color: 'red' },
                  { role: 'Security' as const, label: 'Security', desc: 'Release, input/output time', icon: Shield, color: 'amber' },
                  { role: 'Employee - FTE' as const, label: 'Employee - FTE', desc: 'View own records only', icon: UserIcon, color: 'blue' },
                ].map((r) => {
                  const isSelected = role === r.role;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => setRole(r.role)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col text-left gap-0.5 ${
                        isSelected
                          ? r.color === 'red'
                            ? 'bg-red-600 text-white border-red-700 shadow-xs'
                            : r.color === 'amber'
                            ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs font-black'
                            : 'bg-[#1d4e89] text-white border-[#1d4e89] shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-extrabold">{r.label}</span>
                      </div>
                      <span className={`text-[10px] ${isSelected ? 'opacity-90' : 'text-gray-500'}`}>
                        {r.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1d4e89] hover:bg-[#153b68] text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Create User</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: BULK EXCEL UPLOAD */}
      {activeTab === 'bulk' && (
        <div className="p-5 space-y-4">
          {/* Top Info & Download Template Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  Step 1: Download Standard Excel Template
                </h3>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed max-w-xl">
                The Excel template includes the required columns: <strong className="font-bold">First Name, Last Name, Email ID, Vehicle Number, and Role</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel Template (.xlsx)</span>
            </button>
          </div>

          {bulkError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{bulkError}</span>
            </div>
          )}

          {bulkSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{bulkSuccess}</span>
            </div>
          )}

          {/* Step 2: Drag and Drop Upload Area */}
          {!selectedFile && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                dragOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-gray-300 hover:border-[#1d4e89] bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="p-3.5 bg-blue-100 text-[#1d4e89] rounded-2xl w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black text-gray-900">
                Step 2: Upload Filled Excel File
              </h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Drag and drop your populated <strong className="text-gray-800">.xlsx</strong> file here, or click to browse files
              </p>
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-[#1d4e89] text-white text-xs font-bold rounded-lg shadow-xs pointer-events-none">
                <Upload className="w-3.5 h-3.5" />
                <span>Browse File</span>
              </div>
            </div>
          )}

          {/* Step 3: Parsed File Preview Table */}
          {selectedFile && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between flex-wrap gap-2 border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#1d4e89]" />
                  <div>
                    <div className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                      <span>{selectedFile.name}</span>
                      <span className="text-[10px] text-gray-500 font-normal">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 flex items-center gap-2 mt-0.5">
                      <span>Total Rows: <strong className="text-gray-900">{parsedRows.length}</strong></span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">Valid: {validRows.length}</span>
                      {invalidRowsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-bold">Issues/Duplicates: {invalidRowsCount}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearExcel}
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmBulkUpload}
                    disabled={validRows.length === 0}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                      validRows.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Upload & Create ({validRows.length}) Users</span>
                  </button>
                </div>
              </div>

              {/* Table of Parsed Rows */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#002855] text-white uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">First Name</th>
                      <th className="py-2.5 px-3">Last Name</th>
                      <th className="py-2.5 px-3">Email ID</th>
                      <th className="py-2.5 px-3">Unique Access Code</th>
                      <th className="py-2.5 px-3">Vehicle Number</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.index}
                        className={
                          row.status === 'valid'
                            ? 'hover:bg-emerald-50/40'
                            : 'bg-red-50/50 hover:bg-red-50'
                        }
                      >
                        <td className="py-2 px-3 font-mono text-gray-500">{row.index}</td>
                        <td className="py-2 px-3 font-bold text-gray-900">{row.firstName || '—'}</td>
                        <td className="py-2 px-3 font-bold text-gray-900">{row.lastName || '—'}</td>
                        <td className="py-2 px-3 font-mono text-gray-700">{row.email || '—'}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {row.accessCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono uppercase font-bold text-red-600">
                          {row.vehicleNumber || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.role === 'Admin'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Ready to Import
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full"
                              title={row.errorMessage}
                            >
                              <AlertTriangle className="w-3 h-3" /> {row.errorMessage || 'Invalid'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
