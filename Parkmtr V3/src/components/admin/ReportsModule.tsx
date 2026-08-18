import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { User, ParkingCategory, PARKING_CATEGORIES, ParkingActivityLog } from '../../types';
import {
  subscribeToActivityLogs,
  saveActivityLogToFirestore,
  seedInitialActivityLogs,
  INITIAL_DEMO_LOGS,
} from '../../lib/firebase';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Calendar,
  Clock,
  Car,
  User as UserIcon,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Layers,
  ArrowUpDown,
  FileText,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

interface ReportsModuleProps {
  allUsers: User[];
  currentAdmin: User;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ allUsers, currentAdmin }) => {
  // Super Admin Authorization Gate
  const isSuperAdmin =
    currentAdmin.role === 'Admin Super User' ||
    currentAdmin.role === 'Admin' ||
    currentAdmin.isAdmin ||
    currentAdmin.email.toLowerCase() === 'mugunth.g23@gmail.com';

  // Activity Logs from Firestore & Local Storage
  const [activityLogs, setActivityLogs] = useState<ParkingActivityLog[]>(() => {
    const raw = localStorage.getItem('hdfc_parking_activity_logs');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_DEMO_LOGS;
  });

  // Subscribe to real-time activity logs
  useEffect(() => {
    seedInitialActivityLogs();
    const unsub = subscribeToActivityLogs((logs) => {
      if (logs && logs.length > 0) {
        setActivityLogs(logs);
        localStorage.setItem('hdfc_parking_activity_logs', JSON.stringify(logs));
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ParkingCategory>('all');
  const [selectedAllocType, setSelectedAllocType] = useState<'all' | 'Permanent' | 'Temporary'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'Active' | 'Released'>('all');
  
  // Start Date & End Date Filters (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'custom'>('all');

  const [reportViewTab, setReportViewTab] = useState<'consolidated' | 'active_only' | 'unallocated_only' | 'logs_only' | 'all_users'>('consolidated');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  // Date Presets Handler
  const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'last7days' | 'thisMonth') => {
    setDatePreset(preset);
    const today = new Date('2026-08-18T00:00:00'); // Consistent system date
    const formatDateInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = formatDateInput(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = formatDateInput(yesterday);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'last7days') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      setStartDate(formatDateInput(sevenDaysAgo));
      setEndDate(formatDateInput(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDateInput(firstDay));
      setEndDate(formatDateInput(lastDay));
    }
  };

  // Helper to resolve user access code
  const getUserAccessCode = (email: string, explicitCode?: string) => {
    if (explicitCode) return explicitCode;
    const clean = (email || '').toLowerCase().trim();
    const found = allUsers.find((u) => u.email.toLowerCase().trim() === clean);
    if (found?.accessCode) return found.accessCode;
    if (clean === 'mugunth.g23@gmail.com') return 'ADM-2026';
    if (clean === 'security@hdfcbank.com') return 'SEC-1001';
    if (clean === 'arnav.sharma@email.com') return 'HPK-8924';
    if (clean === 'employee@hdfcbank.com') return 'HPK-1001';
    return 'HPK-1001';
  };

  // Helper to parse record timestamps / dates accurately
  const parseRecordDateTime = (item: { inDate?: string; timestamp?: string; dateWithInTime?: string }): number | null => {
    // 1. Try ISO timestamp
    if (item.timestamp) {
      const t = new Date(item.timestamp).getTime();
      if (!isNaN(t)) return t;
    }
    
    // 2. Try inDate string like "18 Aug 2026" or "2026-08-18"
    const dateStr = item.inDate || item.dateWithInTime;
    if (dateStr && dateStr !== 'N/A') {
      const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`).getTime();
      }
      
      const ddmmyyyyMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const monthStr = ddmmyyyyMatch[2].toLowerCase().substring(0, 3);
        const year = parseInt(ddmmyyyyMatch[3], 10);
        const monthsMap: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        if (monthsMap[monthStr] !== undefined) {
          return new Date(year, monthsMap[monthStr], day).getTime();
        }
      }
      
      const parsed = new Date(dateStr).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    
    return null;
  };

  // Consolidated Report Records Builder
  const consolidatedRecords = useMemo(() => {
    const records: Array<{
      id: string;
      userName: string;
      email: string;
      accessCode: string;
      phone: string;
      vehicleNumber: string;
      category: string;
      slotNumber: number | string;
      allocationType: string;
      inDate: string;
      inTime: string;
      dateWithInTime: string;
      outDate: string;
      outTime: string;
      dateWithOutTime: string;
      status: 'Active' | 'Released' | 'Not Allocated';
      timestamp: string;
      source: 'live_user' | 'activity_log';
    }> = [];

    const seenKeySet = new Set<string>();

    // 1. Live Active Users with Allocations
    allUsers.forEach((u) => {
      if (u.allocatedLot != null || u.allocatedCategory != null) {
        const inD = u.inDate || (u.allocatedAt ? new Date(u.allocatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '18 Aug 2026');
        const inT = u.inTime || (u.allocatedAt ? new Date(u.allocatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '09:00 AM');
        const outD = u.outDate || '';
        const outT = u.outTime || '';

        const dateWithInTime = `${inD} ${inT}`.trim();
        const dateWithOutTime = outD || outT ? `${outD} ${outT}`.trim() : (u.allocationType === 'Temporary' ? 'Active / Open' : 'Permanent (Ongoing)');

        const key = `active_${u.email.toLowerCase()}_${u.allocatedCategory}_${u.allocatedLot}`;
        seenKeySet.add(key);

        records.push({
          id: `live_${u.id}`,
          userName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'HDFC Employee',
          email: u.email,
          accessCode: getUserAccessCode(u.email, u.accessCode),
          phone: u.phone || 'N/A',
          vehicleNumber: u.defaultVehicleNumber || 'N/A',
          category: u.allocatedCategory || 'Basement on GL',
          slotNumber: u.allocatedLot ?? 'Auto',
          allocationType: u.allocationType || 'Permanent',
          inDate: inD,
          inTime: inT,
          dateWithInTime,
          outDate: outD,
          outTime: outT,
          dateWithOutTime,
          status: 'Active',
          timestamp: u.allocatedAt || new Date().toISOString(),
          source: 'live_user',
        });
      }
    });

    // 2. Activity Logs (Historical Check-in and Check-out Events)
    activityLogs.forEach((log) => {
      // If active already added from live user, avoid direct visual duplicate if same timestamp
      const inD = log.inDate || '18 Aug 2026';
      const inT = log.inTime || '09:00 AM';
      const outD = log.outDate || '';
      const outT = log.outTime || '';

      const dateWithInTime = `${inD} ${inT}`.trim();
      const dateWithOutTime = outD || outT ? `${outD} ${outT}`.trim() : (log.status === 'Released' ? 'Released' : 'Active / Open');

      records.push({
        id: log.id,
        userName: log.userName || 'HDFC Employee',
        email: log.userEmail || 'N/A',
        accessCode: getUserAccessCode(log.userEmail),
        phone: log.phone || 'N/A',
        vehicleNumber: log.vehicleNumber || 'N/A',
        category: log.category || 'Underground Basement',
        slotNumber: log.slotNumber ?? 'Auto',
        allocationType: log.allocationType || 'Temporary',
        inDate: inD,
        inTime: inT,
        dateWithInTime,
        outDate: outD,
        outTime: outT,
        dateWithOutTime,
        status: log.status === 'Released' ? 'Released' : 'Active',
        timestamp: log.timestamp || new Date().toISOString(),
        source: 'activity_log',
      });
    });

    // 3. Registered Users Pending Allocation (Not yet allocated a parking slot)
    allUsers.forEach((u) => {
      if (u.allocatedLot == null && u.allocatedCategory == null) {
        const regDate = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '18 Aug 2026';
        records.push({
          id: `unalloc_${u.id}`,
          userName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'HDFC Employee',
          email: u.email,
          accessCode: getUserAccessCode(u.email, u.accessCode),
          phone: u.phone || 'N/A',
          vehicleNumber: u.defaultVehicleNumber || 'N/A',
          category: 'Not Allocated',
          slotNumber: 'N/A',
          allocationType: 'Pending',
          inDate: regDate,
          inTime: 'N/A',
          dateWithInTime: `Registered on ${regDate}`,
          outDate: '',
          outTime: '',
          dateWithOutTime: 'Pending Slot Allocation',
          status: 'Not Allocated',
          timestamp: u.registeredAt || new Date().toISOString(),
          source: 'live_user',
        });
      }
    });

    // Sort by latest timestamp
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allUsers, activityLogs]);

  // Master Users Report Records (All registered users including unallocated)
  const allUsersRecords = useMemo(() => {
    return allUsers.map((u) => {
      const isAllocated = u.allocatedLot != null || u.allocatedCategory != null;
      const inD = u.inDate || (isAllocated ? '18 Aug 2026' : 'N/A');
      const inT = u.inTime || (isAllocated ? '09:00 AM' : 'N/A');
      const outD = u.outDate || '';
      const outT = u.outTime || '';

      const dateWithInTime = isAllocated ? `${inD} ${inT}`.trim() : 'N/A';
      const dateWithOutTime = isAllocated
        ? outD || outT
          ? `${outD} ${outT}`.trim()
          : u.allocationType === 'Temporary'
          ? 'Active / Open'
          : 'Permanent (Ongoing)'
        : 'N/A';

      return {
        id: u.id,
        userName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'HDFC Employee',
        email: u.email,
        accessCode: getUserAccessCode(u.email, u.accessCode),
        phone: u.phone || 'N/A',
        vehicleNumber: u.defaultVehicleNumber || 'N/A',
        category: u.allocatedCategory || (isAllocated ? 'Basement on GL' : 'Not Allocated'),
        slotNumber: u.allocatedLot ?? 'N/A',
        allocationType: u.allocationType || (isAllocated ? 'Permanent' : 'None'),
        inDate: inD,
        inTime: inT,
        dateWithInTime,
        outDate: outD,
        outTime: outT,
        dateWithOutTime,
        status: isAllocated ? ('Active' as const) : ('Not Allocated' as const),
        timestamp: u.allocatedAt || u.registeredAt || new Date().toISOString(),
        source: 'live_user' as const,
      };
    });
  }, [allUsers]);

  // Active Selected Dataset based on Report Tab
  const rawDataset = useMemo(() => {
    if (reportViewTab === 'all_users') {
      return allUsersRecords;
    }
    if (reportViewTab === 'active_only') {
      return consolidatedRecords.filter((r) => r.status === 'Active');
    }
    if (reportViewTab === 'unallocated_only') {
      return consolidatedRecords.filter((r) => r.status === 'Not Allocated');
    }
    if (reportViewTab === 'logs_only') {
      return consolidatedRecords.filter((r) => r.source === 'activity_log');
    }
    return consolidatedRecords;
  }, [reportViewTab, consolidatedRecords, allUsersRecords]);

  // Filtered Dataset with Start Date & End Date Range
  const filteredRecords = useMemo(() => {
    // Convert startDate and endDate to numeric time bounds
    const startBound = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endBound = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return rawDataset.filter((item) => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches =
          item.userName.toLowerCase().includes(query) ||
          item.email.toLowerCase().includes(query) ||
          item.phone.toLowerCase().includes(query) ||
          item.vehicleNumber.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          String(item.slotNumber).toLowerCase().includes(query) ||
          item.dateWithInTime.toLowerCase().includes(query) ||
          item.dateWithOutTime.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      }

      // 3. Allocation Type Filter
      if (selectedAllocType !== 'all') {
        if (item.allocationType !== selectedAllocType) return false;
      }

      // 4. Status Filter
      if (selectedStatus !== 'all') {
        if (item.status !== selectedStatus) return false;
      }

      // 5. Start Date & End Date Range Filter
      if (startBound !== null || endBound !== null) {
        const recordTime = parseRecordDateTime(item);
        if (recordTime !== null) {
          if (startBound !== null && recordTime < startBound) return false;
          if (endBound !== null && recordTime > endBound) return false;
        } else {
          // If date can't be parsed, check string match with YYYY-MM-DD or partial
          if (startDate && !item.inDate.includes(startDate) && !item.dateWithInTime.includes(startDate)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [rawDataset, searchTerm, selectedCategory, selectedAllocType, selectedStatus, startDate, endDate]);

  // Export to Excel Handler based on Selected Date Range & Filters
  const handleExportToExcel = () => {
    if (filteredRecords.length === 0) {
      alert('No records available to export with the current date range and filter selection.');
      return;
    }

    const excelRows = filteredRecords.map((r, index) => ({
      'Sl. No.': index + 1,
      'User Name': r.userName,
      'Email ID': r.email,
      'Unique Access Code': r.accessCode,
      'Phone Number': r.phone,
      'Vehicle Number': r.vehicleNumber,
      'Parking Category': r.category,
      'Allocated Slot': r.slotNumber,
      'Allocation Type': r.allocationType,
      'Date with In-Time': r.dateWithInTime,
      'Date with Out-Time': r.dateWithOutTime,
      'Status': r.status,
      'Logged Timestamp': new Date(r.timestamp).toLocaleString(),
    }));

    // Create Worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Set Column Widths for professional presentation
    worksheet['!cols'] = [
      { wch: 8 },  // Sl. No.
      { wch: 22 }, // User Name
      { wch: 28 }, // Email ID
      { wch: 20 }, // Unique Access Code
      { wch: 18 }, // Phone Number
      { wch: 18 }, // Vehicle Number
      { wch: 24 }, // Parking Category
      { wch: 14 }, // Allocated Slot
      { wch: 18 }, // Allocation Type
      { wch: 24 }, // Date with In-Time
      { wch: 24 }, // Date with Out-Time
      { wch: 14 }, // Status
      { wch: 22 }, // Logged Timestamp
    ];

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Parking_Report');

    // Generate Date-range stamped filename
    let fileName = 'HDFC_Parking_Report';
    if (startDate && endDate) {
      fileName += `_${startDate}_to_${endDate}.xlsx`;
    } else if (startDate) {
      fileName += `_From_${startDate}.xlsx`;
    } else if (endDate) {
      fileName += `_Until_${endDate}.xlsx`;
    } else {
      const dateStamp = new Date().toISOString().split('T')[0];
      fileName += `_${dateStamp}.xlsx`;
    }

    // Download File
    XLSX.writeFile(workbook, fileName);

    const rangeNotice = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Until ${endDate}`
      : 'All Available Dates';

    setDownloadSuccessToast({
      show: true,
      msg: `Excel report for (${rangeNotice}) successfully generated and downloaded with ${filteredRecords.length} records!`,
    });
    setTimeout(() => {
      setDownloadSuccessToast({ show: false, msg: '' });
    }, 4000);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedAllocType('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setDatePreset('all');
  };

  // Access Denied Screen if Not Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-black text-red-600 uppercase tracking-widest block">
            Access Restricted
          </span>
          <h2 className="text-lg font-black text-gray-900">
            Admin Super User Privilege Required
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            The Report module contains confidential audit records, employee contact numbers, vehicle details, and gate check-in/out timings. This section is strictly accessible only to Admin Super Users.
          </p>
        </div>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500 text-left space-y-1">
          <p><strong>Your Current Role:</strong> {currentAdmin.role || 'Standard User'}</p>
          <p><strong>Logged-in Email:</strong> {currentAdmin.email}</p>
        </div>
      </div>
    );
  }

  // Summary Metrics
  const totalRecordsCount = filteredRecords.length;
  const activeCount = filteredRecords.filter((r) => r.status === 'Active').length;
  const unallocatedCount = filteredRecords.filter((r) => r.status === 'Not Allocated').length;
  const temporaryCount = filteredRecords.filter((r) => r.allocationType === 'Temporary').length;
  const permanentCount = filteredRecords.filter((r) => r.allocationType === 'Permanent').length;
  const releasedCount = filteredRecords.filter((r) => r.status === 'Released').length;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#002855] to-[#1d4e89] text-white p-4 rounded-2xl shadow-sm border border-blue-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="p-1 bg-amber-400 text-slate-950 rounded-md font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-slate-950" /> Super User Access
              </span>
              <span className="text-[11px] text-blue-200 font-semibold">
                Official Facility Audit Trail
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-300 flex-shrink-0" />
              Smart Parking Reports & Attendance Log
            </h2>
            <p className="text-xs text-blue-100 mt-0.5 max-w-2xl">
              Comprehensive report of employee vehicles, parking categories, In Date & Time, Out Date & Time, registered users pending allocation, and live slot status. Exportable to Excel (.xlsx).
            </p>
          </div>

          {/* Quick Export Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportToExcel}
              className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-300 active:scale-98"
              title="Download filtered report as Microsoft Excel spreadsheet"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {downloadSuccessToast.show && (
          <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-400/50 rounded-xl text-xs text-emerald-200 font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{downloadSuccessToast.msg}</span>
          </div>
        )}
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">
            Total Report Rows
          </span>
          <span className="text-base font-black text-[#1d4e89]">
            {totalRecordsCount}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs text-center">
          <span className="text-[10px] font-bold text-blue-600 uppercase block">
            Active / Parked
          </span>
          <span className="text-base font-black text-blue-900">
            {activeCount}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-300 shadow-xs text-center bg-amber-50/40">
          <span className="text-[10px] font-bold text-amber-800 uppercase block">
            Pending / Unallocated
          </span>
          <span className="text-base font-black text-amber-900">
            {unallocatedCount}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs text-center">
          <span className="text-[10px] font-bold text-amber-700 uppercase block">
            Temporary Slots
          </span>
          <span className="text-base font-black text-amber-900">
            {temporaryCount}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs text-center">
          <span className="text-[10px] font-bold text-purple-700 uppercase block">
            Permanent Slots
          </span>
          <span className="text-base font-black text-purple-900">
            {permanentCount}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">
            Checked Out / Released
          </span>
          <span className="text-base font-black text-emerald-900">
            {releasedCount}
          </span>
        </div>
      </div>

      {/* 3. Filter & Search Control Panel */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        {/* Tab Selection */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2.5 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setReportViewTab('consolidated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                reportViewTab === 'consolidated'
                  ? 'bg-[#1d4e89] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Records & Logs ({consolidatedRecords.length})
            </button>

            <button
              onClick={() => setReportViewTab('active_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                reportViewTab === 'active_only'
                  ? 'bg-[#1d4e89] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active Occupants ({consolidatedRecords.filter((r) => r.status === 'Active').length})
            </button>

            <button
              onClick={() => setReportViewTab('unallocated_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                reportViewTab === 'unallocated_only'
                  ? 'bg-[#1d4e89] text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Unallocated / Pending ({consolidatedRecords.filter((r) => r.status === 'Not Allocated').length})
            </button>

            <button
              onClick={() => setReportViewTab('logs_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                reportViewTab === 'logs_only'
                  ? 'bg-[#1d4e89] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Gate Logs ({activityLogs.length})
            </button>

            <button
              onClick={() => setReportViewTab('all_users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                reportViewTab === 'all_users'
                  ? 'bg-[#1d4e89] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Registered Users ({allUsers.length})
            </button>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 flex-shrink-0"
            title="Reset all search queries and dropdown filters"
          >
            <RotateCcw className="w-3 h-3" /> Reset Filters
          </button>
        </div>

        {/* Search & Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Text Search */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Search by Name, Email, Vehicle, Phone
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search report records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Parking Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
            >
              <option value="all">All Categories</option>
              <option value="Not Allocated">Not Allocated / Pending</option>
              {PARKING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Allocation Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Allocation Type
            </label>
            <select
              value={selectedAllocType}
              onChange={(e) => setSelectedAllocType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
            >
              <option value="all">All Allocation Types</option>
              <option value="Temporary">Temporary (With In/Out Timings)</option>
              <option value="Permanent">Permanent</option>
              <option value="Pending">Pending Slot Allocation</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Parking Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active / Parked</option>
              <option value="Not Allocated">Not Allocated / Pending</option>
              <option value="Released">Checked Out / Released</option>
            </select>
          </div>
        </div>

        {/* Date Range Filter Section */}
        <div className="pt-2.5 border-t border-gray-100 space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Start Date & End Date Pickers */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 px-2.5 py-1.5 rounded-xl">
                <label className="text-[10px] font-black text-gray-500 uppercase whitespace-nowrap flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#1d4e89]" /> Start Date:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                />
              </div>

              <span className="text-gray-400 font-black text-xs">→</span>

              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 px-2.5 py-1.5 rounded-xl">
                <label className="text-[10px] font-black text-gray-500 uppercase whitespace-nowrap flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#1d4e89]" /> End Date:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('all');
                  }}
                  className="p-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  title="Clear start and end date filters"
                >
                  ✕ Clear Dates
                </button>
              )}
            </div>

            {/* Quick Date Range Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-gray-400 uppercase hidden sm:inline">
                Presets:
              </span>

              <button
                onClick={() => applyDatePreset('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  datePreset === 'all' && !startDate && !endDate
                    ? 'bg-[#1d4e89] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Dates
              </button>

              <button
                onClick={() => applyDatePreset('today')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-[#1d4e89] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today (18 Aug)
              </button>

              <button
                onClick={() => applyDatePreset('yesterday')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  datePreset === 'yesterday'
                    ? 'bg-[#1d4e89] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Yesterday (17 Aug)
              </button>

              <button
                onClick={() => applyDatePreset('last7days')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  datePreset === 'last7days'
                    ? 'bg-[#1d4e89] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last 7 Days
              </button>

              <button
                onClick={() => applyDatePreset('thisMonth')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  datePreset === 'thisMonth'
                    ? 'bg-[#1d4e89] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month (Aug 2026)
              </button>
            </div>
          </div>

          {/* Active Range Feedback Banner */}
          {(startDate || endDate) && (
            <div className="flex items-center justify-between gap-2 p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#1d4e89] font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1d4e89] flex-shrink-0" />
                <span>
                  Active Date Range:{' '}
                  <strong>
                    {startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Beginning'}
                  </strong>{' '}
                  to{' '}
                  <strong>
                    {endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Latest'}
                  </strong>
                  {' — '}
                  <span className="font-bold">{filteredRecords.length} records matching</span>
                </span>
              </div>

              <button
                onClick={handleExportToExcel}
                className="px-2.5 py-1 bg-[#1d4e89] hover:bg-[#153a66] text-white text-[11px] font-black rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              >
                <Download className="w-3 h-3" />
                <span>Download this Range ({filteredRecords.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Main Report Data Presentation */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-3.5 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#1d4e89]" />
            <h3 className="text-xs font-extrabold text-gray-900">
              Report Data Records ({filteredRecords.length} found)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToExcel}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-98"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {filteredRecords.length} Rows to Excel</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
            <h4 className="text-sm font-bold text-gray-700">No report records found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              No matching records found for the active search and filter criteria. Try resetting filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-2 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg border border-gray-300 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3">User Details</th>
                    <th className="py-2.5 px-3">Contact & Phone</th>
                    <th className="py-2.5 px-3">Vehicle No.</th>
                    <th className="py-2.5 px-3">Parking Category</th>
                    <th className="py-2.5 px-3">Alloc Type</th>
                    <th className="py-2.5 px-3">Date with In-Time</th>
                    <th className="py-2.5 px-3">Date with Out-Time</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  {filteredRecords.map((row, idx) => {
                    const isTemp = row.allocationType === 'Temporary';
                    const isActive = row.status === 'Active';
                    const isUnallocated = row.status === 'Not Allocated';

                    return (
                      <tr
                        key={`${row.id}_${idx}`}
                        className="hover:bg-blue-50/50 transition-colors odd:bg-white even:bg-gray-50/40"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-gray-500 font-bold">
                          {idx + 1}
                        </td>

                        {/* User Name & Email */}
                        <td className="py-2.5 px-3">
                          <div className="font-extrabold text-gray-900 flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-[#1d4e89] flex-shrink-0" />
                            <span>{row.userName}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono truncate max-w-[180px]">
                            {row.email}
                          </div>
                        </td>

                        {/* Phone Number */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-gray-700 flex items-center gap-1 font-semibold">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{row.phone}</span>
                          </div>
                        </td>

                        {/* Vehicle Number */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-300 inline-block text-xs">
                            {row.vehicleNumber}
                          </div>
                        </td>

                        {/* Parking Category (Slot number removed below category) */}
                        <td className="py-2.5 px-3">
                          <div
                            className={`font-bold truncate max-w-[180px] ${
                              isUnallocated ? 'text-amber-800 font-extrabold' : 'text-[#1d4e89]'
                            }`}
                          >
                            {row.category}
                          </div>
                        </td>

                        {/* Allocation Type */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block ${
                              isTemp
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : row.allocationType === 'Permanent'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isUnallocated
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.allocationType}
                          </span>
                        </td>

                        {/* Date with In-Time */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{row.dateWithInTime}</span>
                          </div>
                        </td>

                        {/* Date with Out-Time */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-gray-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span
                              className={
                                row.dateWithOutTime.includes('Active') || row.dateWithOutTime.includes('Open')
                                  ? 'text-amber-800 font-bold'
                                  : isUnallocated
                                  ? 'text-amber-700 font-medium italic'
                                  : 'text-gray-900 font-bold'
                              }
                            >
                              {row.dateWithOutTime}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase inline-block ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : row.status === 'Released'
                                ? 'bg-gray-200 text-gray-800'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {row.status === 'Not Allocated' ? 'Pending Allocation' : row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredRecords.map((row, idx) => {
                const isTemp = row.allocationType === 'Temporary';
                const isActive = row.status === 'Active';
                const isUnallocated = row.status === 'Not Allocated';

                return (
                  <div key={`m_${row.id}_${idx}`} className="p-3.5 space-y-2.5 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            #{idx + 1}
                          </span>
                          <h4 className="text-xs font-black text-gray-900 truncate">
                            {row.userName}
                          </h4>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : isUnallocated
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.status === 'Not Allocated' ? 'Pending' : row.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono truncate">
                          {row.email}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-mono font-black text-xs text-slate-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-300 block">
                          {row.vehicleNumber}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">
                          Phone Number
                        </span>
                        <span className="font-mono text-gray-800 font-semibold text-[11px]">
                          {row.phone}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">
                          Parking Category
                        </span>
                        <span
                          className={`font-bold text-[11px] truncate block ${
                            isUnallocated ? 'text-amber-800 font-extrabold' : 'text-[#1d4e89]'
                          }`}
                        >
                          {row.category}
                        </span>
                      </div>

                      <div className="col-span-2 pt-1 border-t border-gray-200">
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">
                          Allocation Type
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase inline-block mt-0.5 ${
                            isTemp
                              ? 'bg-amber-100 text-amber-900'
                              : row.allocationType === 'Permanent'
                              ? 'bg-purple-100 text-purple-900'
                              : isUnallocated
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {row.allocationType}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">
                          Date with In-Time
                        </span>
                        <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          {row.dateWithInTime}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">
                          Date with Out-Time
                        </span>
                        <span className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                          {row.dateWithOutTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Table Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <strong>{filteredRecords.length}</strong> of <strong>{rawDataset.length}</strong> records
          </span>
          <button
            onClick={handleExportToExcel}
            className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download Full Report (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
};
