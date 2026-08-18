import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { User, ParkingCategory, PARKING_CATEGORIES, DEFAULT_CATEGORY_CAPACITIES, ParkingActivityLog } from '../../types';
import { HdfcLogo } from '../HdfcLogo';
import {
  subscribeToUsers,
  saveUserToFirestore,
  saveUsersBatchToFirestore,
  deleteUserFromFirestore,
  deduplicateUsersList,
  getUserDocId,
  saveActivityLogToFirestore,
} from '../../lib/firebase';
import { RoleManagement } from './RoleManagement';
import { ModalQrScanner } from './ModalQrScanner';
import { CreateAndBulkUploadUsers } from './CreateAndBulkUploadUsers';
import { ReportsModule } from './ReportsModule';
import { getCategoryIcon, getCategoryTheme } from './CategoryDetailModal';
import { UserQrDashboard } from '../profile/UserQrDashboard';
import {
  Shield,
  ShieldCheck,
  Users,
  Car,
  Search,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Trash2,
  RefreshCw,
  Layers,
  Sparkles,
  Phone,
  Mail,
  X,
  FileSpreadsheet,
  QrCode,
  UserPlus,
  Upload,
  Building,
  Building2,
  Compass,
  ArrowUpDown,
  Sliders,
  Check,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Calendar,
  Menu,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

const getTodayFormattedDate = () => {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // e.g. "18 Aug 2026"
};

const getNowFormattedTime = () => {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); // e.g. "05:22 PM"
};

interface AdminDashboardProps {
  adminUser: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUser, onLogout }) => {
  // Role permissions checking
  const isSuperAdmin =
    adminUser.role === 'Admin Super User' ||
    adminUser.role === 'Admin' ||
    adminUser.isAdmin ||
    adminUser.email.toLowerCase() === 'mugunth.g23@gmail.com';
  const isSecurity = adminUser.role === 'Security';
  const isEmployeeOnly = adminUser.role === 'Employee - FTE' || (!isSuperAdmin && !isSecurity);
  const canAllocate = isSuperAdmin || isSecurity;

  // Active Module in Dashboard: 'lots' (5-Category Dashboard & Slot Views), 'create_bulk', 'roles', 'reports', or 'my_pass' (Digital QR Pass)
  const [activeModule, setActiveModule] = useState<'lots' | 'create_bulk' | 'roles' | 'reports' | 'my_pass'>('lots');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Category Capacities state (Super Admin can create / set slots for each category)
  const [categoryCapacities, setCategoryCapacities] = useState<Record<ParkingCategory, number>>(() => {
    const raw = localStorage.getItem('hdfc_category_capacities');
    if (raw) {
      try {
        return { ...DEFAULT_CATEGORY_CAPACITIES, ...JSON.parse(raw) };
      } catch {
        return DEFAULT_CATEGORY_CAPACITIES;
      }
    }
    return DEFAULT_CATEGORY_CAPACITIES;
  });

  // Super Admin inline slot creation modal state
  const [categoryToSetCapacity, setCategoryToSetCapacity] = useState<ParkingCategory | null>(null);
  const [capacityInputVal, setCapacityInputVal] = useState<string>('100');
  const [capacitySetError, setCapacitySetError] = useState('');
  const [capacitySetSuccess, setCapacitySetSuccess] = useState('');

  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ParkingCategory>('all');
  const [filterType, setFilterType] = useState<'all' | 'allocated' | 'unallocated' | 'permanent' | 'temporary'>('all');

  // Allocation Modal State (No default user, Search / QR Code, Category Selection, Permanent/Temporary)
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [selectedUserForAlloc, setSelectedUserForAlloc] = useState<User | null>(null);
  const [allocCategory, setAllocCategory] = useState<ParkingCategory>('Underground Basement');
  const [allocType, setAllocType] = useState<'Permanent' | 'Temporary'>('Permanent');
  const [allocInDate, setAllocInDate] = useState<string>(getTodayFormattedDate());
  const [allocInTime, setAllocInTime] = useState<string>('09:00 AM');
  const [allocOutDate, setAllocOutDate] = useState<string>('');
  const [allocOutTime, setAllocOutTime] = useState<string>('');
  const [allocUserSearchQuery, setAllocUserSearchQuery] = useState('');
  const [allocMethod, setAllocMethod] = useState<'search' | 'qr'>('search');
  const [allocQrInput, setAllocQrInput] = useState('');
  const [allocError, setAllocError] = useState('');
  const [allocSuccessMsg, setAllocSuccessMsg] = useState('');

  // Release Temporary Lot Modal State
  const [userToRelease, setUserToRelease] = useState<User | null>(null);
  const [releaseOutDate, setReleaseOutDate] = useState<string>(getTodayFormattedDate());
  const [releaseOutTime, setReleaseOutTime] = useState<string>('');
  const [releaseError, setReleaseError] = useState<string>('');
  const [permanentDeniedUser, setPermanentDeniedUser] = useState<User | null>(null);

  // Lot Inspector State
  const [inspectCategory, setInspectCategory] = useState<ParkingCategory>('Basement on GL');
  const [inspectLotNumber, setInspectLotNumber] = useState<number | ''>('');

  // Syncing Feedback State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Save Category Capacities
  const handleUpdateCategoryCapacity = (category: ParkingCategory, newTotal: number) => {
    setCategoryCapacities((prev) => {
      const updated = { ...prev, [category]: newTotal };
      localStorage.setItem('hdfc_category_capacities', JSON.stringify(updated));
      return updated;
    });
  };

  // Submit Super Admin Slot Creation
  const handleCapacitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToSetCapacity) return;

    setCapacitySetError('');
    setCapacitySetSuccess('');

    const num = parseInt(capacityInputVal, 10);
    if (isNaN(num) || num < 1 || num > 5000) {
      setCapacitySetError('Please enter a valid number of slots between 1 and 5,000.');
      return;
    }

    const occupiedInCat = users.filter(
      (u) =>
        u.allocatedLot != null &&
        (u.allocatedCategory === categoryToSetCapacity ||
          (!u.allocatedCategory && categoryToSetCapacity === 'Basement on GL'))
    ).length;

    if (num < occupiedInCat) {
      setCapacitySetError(
        `Cannot reduce slots to ${num} because ${occupiedInCat} slots are currently occupied in ${categoryToSetCapacity}.`
      );
      return;
    }

    handleUpdateCategoryCapacity(categoryToSetCapacity, num);
    setCapacitySetSuccess(`Successfully created ${num} slots for "${categoryToSetCapacity}"!`);

    setTimeout(() => {
      setCategoryToSetCapacity(null);
      setCapacitySetSuccess('');
    }, 1200);
  };

  // Load Users from LocalStorage & Deduplicate
  const loadUsersFromStorage = () => {
    const raw = localStorage.getItem('hdfc_parking_users');
    let loadedUsers: User[] = [];

    if (raw) {
      try {
        loadedUsers = JSON.parse(raw);
      } catch (err) {
        console.error(err);
      }
    }

    // Default demo users if empty
    if (loadedUsers.length === 0) {
      loadedUsers = [
        {
          id: 'usr_admin_1',
          firstName: 'Mugunth',
          lastName: 'G',
          email: 'mugunth.g23@gmail.com',
          phone: '+91 98765 43210',
          role: 'Admin Super User',
          isAdmin: true,
          defaultVehicleNumber: 'ADMIN01',
          employeeId: 'HDFC-ADMIN-01',
          allocatedCategory: null,
          allocatedLot: null,
          allocationType: null,
          inTime: null,
          outTime: null,
        },
        {
          id: 'usr_demo_1',
          firstName: 'Arnav',
          lastName: 'Sharma',
          email: 'arnav.sharma@email.com',
          phone: '+91 98765 43210',
          role: 'Employee - FTE',
          defaultVehicleNumber: 'MH02CP4821',
          employeeId: 'HDFC-89241',
          allocatedCategory: 'Basement on GL',
          allocatedLot: 42,
          allocationType: 'Permanent',
          inTime: null,
          outTime: null,
        },
        {
          id: 'usr_demo_3',
          firstName: 'HDFC',
          lastName: 'Employee',
          email: 'employee@hdfcbank.com',
          phone: '+91 98765 00000',
          role: 'Employee - FTE',
          defaultVehicleNumber: 'MH01AB1234',
          employeeId: 'HDFC-10001',
          allocatedCategory: 'Underground Basement',
          allocatedLot: 10,
          allocationType: 'Temporary',
          inTime: '09:00 AM',
          outTime: '06:00 PM',
        },
      ];
    }

    // Ensure Master Admin account exists
    const hasMasterAdmin = loadedUsers.some(
      (u) => u.email.toLowerCase() === 'mugunth.g23@gmail.com'
    );
    if (!hasMasterAdmin) {
      loadedUsers.unshift({
        id: 'usr_admin_1',
        firstName: 'Mugunth',
        lastName: 'G',
        email: 'mugunth.g23@gmail.com',
        phone: '+91 98765 43210',
        role: 'Admin Super User',
        isAdmin: true,
        defaultVehicleNumber: 'ADMIN01',
        employeeId: 'HDFC-ADMIN-01',
        allocatedCategory: null,
        allocatedLot: null,
        allocationType: null,
        inTime: null,
        outTime: null,
      });
    }

    // Deduplicate strictly by email address
    const deduplicated = deduplicateUsersList(loadedUsers);
    setAllUsersList(deduplicated);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(deduplicated));

    // For regular lot allocation, filter out root master admin to prevent self-allocation
    const nonAdminUsers = deduplicated.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonAdminUsers);
    return nonAdminUsers.length;
  };

  const handleSyncList = () => {
    setIsSyncing(true);
    setSyncToast(null);

    setTimeout(() => {
      const count = loadUsersFromStorage();
      setIsSyncing(false);
      setSyncToast(`Synced! Directory refreshed with ${count} registered user account${count === 1 ? '' : 's'}.`);

      setTimeout(() => {
        setSyncToast(null);
      }, 4000);
    }, 400);
  };

  useEffect(() => {
    // Initial local load
    loadUsersFromStorage();

    // Subscribe to real-time Firestore collection
    const unsubscribe = subscribeToUsers((allFirestoreUsers) => {
      if (allFirestoreUsers && allFirestoreUsers.length > 0) {
        const deduplicated = deduplicateUsersList(allFirestoreUsers);
        localStorage.setItem('hdfc_parking_users', JSON.stringify(deduplicated));
        setAllUsersList(deduplicated);
        const nonAdminUsers = deduplicated.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
        setUsers(nonAdminUsers);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Save Users Back to LocalStorage & Cloud Firestore
  const saveUsersToStorage = (updatedList: User[]) => {
    const deduplicatedNonAdmin = deduplicateUsersList(updatedList);
    setUsers(deduplicatedNonAdmin);

    // Merge with full storage list including Admin
    const raw = localStorage.getItem('hdfc_parking_users');
    let fullList: User[] = [];
    if (raw) {
      try {
        fullList = JSON.parse(raw);
      } catch (err) {
        console.error(err);
      }
    }

    const adminAccount = fullList.find((u) => u.email.toLowerCase() === 'mugunth.g23@gmail.com') || adminUser;

    const merged = deduplicateUsersList([
      ...deduplicatedNonAdmin.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com'),
      adminAccount,
    ]);
    setAllUsersList(merged);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(merged));

    // Save batch to Cloud Firestore
    saveUsersBatchToFirestore(merged).catch((err) => console.error('Firestore batch save error:', err));

    // Also update active session if current logged-in user is updated
    const activeRaw = localStorage.getItem('hdfc_active_session');
    if (activeRaw) {
      try {
        const active = JSON.parse(activeRaw);
        const match = merged.find((u) => u.email.toLowerCase() === active.email.toLowerCase());
        if (match) {
          localStorage.setItem('hdfc_active_session', JSON.stringify(match));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Role Management Handlers
  const handleUpdateUserRole = (userId: string, newRole: User['role'], makeAdmin: boolean) => {
    const updatedAll = allUsersList.map((u) => {
      if (u.id === userId || u.email.toLowerCase() === userId.toLowerCase()) {
        return {
          ...u,
          role: newRole,
          isAdmin: makeAdmin,
        };
      }
      return u;
    });

    const deduplicated = deduplicateUsersList(updatedAll);
    setAllUsersList(deduplicated);
    const nonRoot = deduplicated.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonRoot);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(deduplicated));
    saveUsersBatchToFirestore(deduplicated).catch((err) => console.error('Firestore role save error:', err));
  };

  const handleAddNewUserWithRole = (newUser: User) => {
    const cleanEmail = newUser.email.toLowerCase().trim();
    const standardizedUser: User = {
      ...newUser,
      id: getUserDocId(cleanEmail),
      email: cleanEmail,
    };
    const updatedAll = deduplicateUsersList([standardizedUser, ...allUsersList]);
    setAllUsersList(updatedAll);
    const nonRoot = updatedAll.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonRoot);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(updatedAll));
    saveUserToFirestore(standardizedUser).catch((err) => console.error('Firestore new user save error:', err));
  };

  const handleBulkAddUsers = (newUsers: User[]) => {
    const standardizedNew = newUsers.map((u) => ({
      ...u,
      id: getUserDocId(u.email),
      email: u.email.toLowerCase().trim(),
    }));

    const updatedAll = deduplicateUsersList([...standardizedNew, ...allUsersList]);
    setAllUsersList(updatedAll);
    const nonRoot = updatedAll.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonRoot);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(updatedAll));
    saveUsersBatchToFirestore(updatedAll).catch((err) => console.error('Firestore bulk save error:', err));
  };

  const handleDeleteUser = (userId: string) => {
    const targetUser = allUsersList.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
    if (!targetUser) return;

    if (targetUser.email.toLowerCase() === 'mugunth.g23@gmail.com') {
      return;
    }

    const updatedAll = allUsersList.filter((u) => u.id !== targetUser.id && u.email.toLowerCase() !== targetUser.email.toLowerCase());
    const deduplicated = deduplicateUsersList(updatedAll);
    setAllUsersList(deduplicated);
    const nonRoot = deduplicated.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonRoot);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(deduplicated));
    
    deleteUserFromFirestore(targetUser.id).catch((err) => console.error('Firestore delete sync error:', err));
    deleteUserFromFirestore(targetUser.email).catch(() => {});
  };

  const handleUpdateSingleUser = (updatedUser: User) => {
    const updatedAll = allUsersList.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setAllUsersList(updatedAll);
    const nonRoot = updatedAll.filter((u) => u.email.toLowerCase() !== 'mugunth.g23@gmail.com');
    setUsers(nonRoot);
    localStorage.setItem('hdfc_parking_users', JSON.stringify(updatedAll));
    saveUserToFirestore(updatedUser).catch((err) => console.error('Firestore user save error:', err));
  };

  // Open Allocation Modal (Starts without default user, sets target category)
  const handleOpenAllocationModal = (user?: User, preselectedCategory?: ParkingCategory) => {
    setIsAllocationModalOpen(true);
    setSelectedUserForAlloc(user || null); // No default user if opened from category!
    setAllocCategory(preselectedCategory || (user?.allocatedCategory as ParkingCategory) || 'Underground Basement');
    setAllocType(user?.allocationType || 'Permanent');
    setAllocInDate(user?.inDate || getTodayFormattedDate());
    setAllocInTime(user?.inTime || getNowFormattedTime());
    setAllocOutDate(user?.outDate || '');
    setAllocOutTime(user?.outTime || '');
    setAllocUserSearchQuery('');
    setAllocMethod('search');
    setAllocQrInput('');
    setAllocError('');
    setAllocSuccessMsg('');
  };

  // Submit Allocation (Automated slot assignment: no manual slot input needed, decrements remaining free slots)
  const handleConfirmAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    setAllocError('');
    setAllocSuccessMsg('');

    if (!selectedUserForAlloc) {
      setAllocError('Please search and select a user or scan their QR code first.');
      return;
    }

    const maxCapacity = categoryCapacities[allocCategory] || 100;

    // Get all occupied slots in this category (excluding the current user if they are already in this category)
    const occupiedUsers = users.filter(
      (u) =>
        (u.allocatedCategory === allocCategory || (!u.allocatedCategory && allocCategory === 'Basement on GL')) &&
        u.allocatedLot != null &&
        u.id !== selectedUserForAlloc.id
    );

    // Validation: Check if category is already at or above maximum available slot capacity
    if (occupiedUsers.length >= maxCapacity) {
      setAllocError(
        `Validation Error: Cannot allocate! "${allocCategory}" has reached its maximum capacity of ${maxCapacity} slots (${occupiedUsers.length}/${maxCapacity} occupied, 0 available). System does not allow allocating beyond available slots.`
      );
      return;
    }

    const occupiedSlots = new Set(occupiedUsers.map((u) => Number(u.allocatedLot)));

    // Find the next available free slot number in this category
    let nextFreeSlot: number | null = null;
    for (let slot = 1; slot <= maxCapacity; slot++) {
      if (!occupiedSlots.has(slot)) {
        nextFreeSlot = slot;
        break;
      }
    }

    if (nextFreeSlot === null || nextFreeSlot > maxCapacity) {
      setAllocError(
        `Validation Error: All ${maxCapacity} slots in "${allocCategory}" are currently occupied! System will not allow allocating more than available slots. Please choose another category or release an existing occupant.`
      );
      return;
    }

    // Update User with Allocated Category & Auto-assigned Free Slot
    const allocatedInDate = allocType === 'Temporary' ? (allocInDate || getTodayFormattedDate()) : getTodayFormattedDate();
    const allocatedInTime = allocType === 'Temporary' ? (allocInTime || getNowFormattedTime()) : getNowFormattedTime();
    const allocatedOutDate = allocType === 'Temporary' ? (allocOutDate.trim() || null) : null;
    const allocatedOutTime = allocType === 'Temporary' ? (allocOutTime.trim() || null) : null;

    const updatedUsers = users.map((u) => {
      if (u.id === selectedUserForAlloc.id) {
        return {
          ...u,
          allocatedCategory: allocCategory,
          allocatedLot: nextFreeSlot,
          allocationType: allocType,
          inDate: allocatedInDate,
          inTime: allocatedInTime,
          outDate: allocatedOutDate,
          outTime: allocatedOutTime,
          allocatedAt: new Date().toISOString(),
        };
      }
      return u;
    });

    saveUsersToStorage(updatedUsers);

    // Save comprehensive audit activity log
    const newLog: ParkingActivityLog = {
      id: `log_${Date.now()}_${selectedUserForAlloc.id}`,
      userId: selectedUserForAlloc.id,
      userName: `${selectedUserForAlloc.firstName || ''} ${selectedUserForAlloc.lastName || ''}`.trim() || 'User',
      userEmail: selectedUserForAlloc.email,
      phone: selectedUserForAlloc.phone || 'N/A',
      vehicleNumber: selectedUserForAlloc.defaultVehicleNumber || 'N/A',
      category: allocCategory,
      slotNumber: nextFreeSlot,
      allocationType: allocType,
      inDate: allocatedInDate,
      inTime: allocatedInTime,
      outDate: allocatedOutDate,
      outTime: allocatedOutTime,
      status: 'Active',
      actionType: 'Allocated',
      timestamp: new Date().toISOString(),
      actionBy: `${adminUser.firstName} ${adminUser.lastName} (${adminUser.role || 'Admin'})`,
    };
    saveActivityLogToFirestore(newLog).catch(() => {});
    try {
      const rawLogs = localStorage.getItem('hdfc_parking_activity_logs');
      const existingLogs: ParkingActivityLog[] = rawLogs ? JSON.parse(rawLogs) : [];
      localStorage.setItem('hdfc_parking_activity_logs', JSON.stringify([newLog, ...existingLogs]));
    } catch (e) {
      console.error(e);
    }

    const remainingFree = Math.max(0, maxCapacity - (occupiedUsers.length + 1));
    setAllocSuccessMsg(
      `Successfully allocated "${allocCategory}" (${allocType}) to ${selectedUserForAlloc.firstName} ${selectedUserForAlloc.lastName}! Category free slots remaining: ${remainingFree} / ${maxCapacity}.`
    );

    setTimeout(() => {
      setIsAllocationModalOpen(false);
      setSelectedUserForAlloc(null);
      setAllocSuccessMsg('');
    }, 1400);
  };

  // Release Lot
  const handleReleaseLot = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target || (!target.allocatedLot && !target.allocatedCategory)) return;

    const isPermanent = target.allocationType === 'Permanent' || (!target.allocationType && (target.allocatedLot != null || target.allocatedCategory != null));

    // Security is only allowed to release temporary slots. If target is permanent, alert the Security officer
    if (isSecurity && isPermanent) {
      setPermanentDeniedUser(target);
      return;
    }

    // If temporary allocation, require mandatory Out Time entry before releasing
    if (target.allocationType === 'Temporary') {
      setUserToRelease(target);
      setReleaseOutDate(getTodayFormattedDate());
      setReleaseOutTime(getNowFormattedTime());
      setReleaseError('');
      return;
    }

    const catName = target.allocatedCategory || 'Basement on GL';
    if (
      confirm(
        `Are you sure you want to release permanent parking allocation in "${catName}" for ${target.firstName} ${target.lastName}? The slot will immediately become free.`
      )
    ) {
      const updated = users.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            allocatedCategory: null,
            allocatedLot: null,
            allocationType: null,
            inDate: null,
            inTime: null,
            outDate: null,
            outTime: null,
            allocatedAt: null,
          };
        }
        return u;
      });

      saveUsersToStorage(updated);

      // Record release activity log
      const releaseLog: ParkingActivityLog = {
        id: `log_${Date.now()}_${target.id}`,
        userId: target.id,
        userName: `${target.firstName || ''} ${target.lastName || ''}`.trim() || 'User',
        userEmail: target.email,
        phone: target.phone || 'N/A',
        vehicleNumber: target.defaultVehicleNumber || 'N/A',
        category: catName,
        slotNumber: target.allocatedLot ?? null,
        allocationType: target.allocationType || 'Permanent',
        inDate: target.inDate || getTodayFormattedDate(),
        inTime: target.inTime || '09:00 AM',
        outDate: getTodayFormattedDate(),
        outTime: getNowFormattedTime(),
        status: 'Released',
        actionType: 'Released',
        timestamp: new Date().toISOString(),
        actionBy: `${adminUser.firstName} ${adminUser.lastName} (${adminUser.role || 'Admin'})`,
      };
      saveActivityLogToFirestore(releaseLog).catch(() => {});
      try {
        const rawLogs = localStorage.getItem('hdfc_parking_activity_logs');
        const existingLogs: ParkingActivityLog[] = rawLogs ? JSON.parse(rawLogs) : [];
        localStorage.setItem('hdfc_parking_activity_logs', JSON.stringify([releaseLog, ...existingLogs]));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Submit Release for Temporary Lot with mandatory Out Time
  const handleConfirmReleaseTemporary = (e: React.FormEvent) => {
    e.preventDefault();
    setReleaseError('');

    if (!userToRelease) return;

    if (!releaseOutTime.trim()) {
      setReleaseError('Out Time is mandatory to release temporary slot allocation!');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === userToRelease.id) {
        return {
          ...u,
          allocatedCategory: null,
          allocatedLot: null,
          allocationType: null,
          inDate: null,
          inTime: null,
          outDate: null,
          outTime: null,
          allocatedAt: null,
        };
      }
      return u;
    });

    saveUsersToStorage(updated);

    // Record temporary release activity log with exact Out Date & Time
    const releaseLog: ParkingActivityLog = {
      id: `log_${Date.now()}_${userToRelease.id}`,
      userId: userToRelease.id,
      userName: `${userToRelease.firstName || ''} ${userToRelease.lastName || ''}`.trim() || 'User',
      userEmail: userToRelease.email,
      phone: userToRelease.phone || 'N/A',
      vehicleNumber: userToRelease.defaultVehicleNumber || 'N/A',
      category: userToRelease.allocatedCategory || 'Underground Basement',
      slotNumber: userToRelease.allocatedLot ?? null,
      allocationType: 'Temporary',
      inDate: userToRelease.inDate || getTodayFormattedDate(),
      inTime: userToRelease.inTime || '09:00 AM',
      outDate: releaseOutDate || getTodayFormattedDate(),
      outTime: releaseOutTime.trim(),
      status: 'Released',
      actionType: 'Released',
      timestamp: new Date().toISOString(),
      actionBy: `${adminUser.firstName} ${adminUser.lastName} (${adminUser.role || 'Admin'})`,
    };
    saveActivityLogToFirestore(releaseLog).catch(() => {});
    try {
      const rawLogs = localStorage.getItem('hdfc_parking_activity_logs');
      const existingLogs: ParkingActivityLog[] = rawLogs ? JSON.parse(rawLogs) : [];
      localStorage.setItem('hdfc_parking_activity_logs', JSON.stringify([releaseLog, ...existingLogs]));
    } catch (e) {
      console.error(e);
    }

    setUserToRelease(null);
  };

  // Calculate Statistics for all 5 Categories
  const categoryStats = PARKING_CATEGORIES.map((cat) => {
    const total = categoryCapacities[cat] || 100;
    const catUsers = users.filter(
      (u) =>
        u.allocatedLot != null &&
        (u.allocatedCategory === cat || (!u.allocatedCategory && cat === 'Basement on GL'))
    );
    const allocated = catUsers.length;
    const free = Math.max(0, total - allocated);
    const permanent = catUsers.filter((u) => u.allocationType === 'Permanent').length;
    const temporary = catUsers.filter((u) => u.allocationType === 'Temporary').length;
    const percent = total > 0 ? Math.round((allocated / total) * 100) : 0;

    return {
      category: cat,
      total,
      allocated,
      free,
      permanent,
      temporary,
      percent,
    };
  });

  // Master Facility Totals across all 5 Categories
  const totalFacilitySlots = categoryStats.reduce((acc, c) => acc + c.total, 0);
  const totalFacilityAllocated = categoryStats.reduce((acc, c) => acc + c.allocated, 0);
  const totalFacilityFree = Math.max(0, totalFacilitySlots - totalFacilityAllocated);
  const totalPermanent = users.filter((u) => u.allocationType === 'Permanent').length;
  const totalTemporary = users.filter((u) => u.allocationType === 'Temporary').length;

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    // If Employee - FTE, strictly show only their own record
    if (isEmployeeOnly && u.email.toLowerCase() !== adminUser.email.toLowerCase()) {
      return false;
    }

    const query = searchTerm.toLowerCase();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = u.email.toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const vehicle = (u.defaultVehicleNumber || '').toLowerCase();
    const catStr = (u.allocatedCategory || 'Basement on GL').toLowerCase();
    const lotStr = u.allocatedLot ? `slot ${u.allocatedLot} lot ${u.allocatedLot}` : '';

    const matchesSearch =
      fullName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      vehicle.includes(query) ||
      catStr.includes(query) ||
      lotStr.includes(query);

    if (!matchesSearch) return false;

    // Filter by Category
    if (categoryFilter !== 'all') {
      const userCat = u.allocatedCategory || (u.allocatedLot ? 'Basement on GL' : null);
      if (userCat !== categoryFilter) return false;
    }

    // Filter by Status / Type
    if (filterType === 'allocated') return u.allocatedLot != null;
    if (filterType === 'unallocated') return u.allocatedLot == null;
    if (filterType === 'permanent') return u.allocationType === 'Permanent';
    if (filterType === 'temporary') return u.allocationType === 'Temporary';

    return true;
  });

  // Lot Inspector lookup in selected category
  const inspectedLotUser = inspectLotNumber
    ? users.find(
        (u) =>
          (u.allocatedCategory || 'Basement on GL') === inspectCategory &&
          u.allocatedLot === Number(inspectLotNumber)
      )
    : null;

  // Export User & Lot Records to Excel (.xlsx)
  const handleExportToExcel = (exportScope: 'all' | 'filtered' = 'all') => {
    const recordsToExport = exportScope === 'filtered' ? filteredUsers : users;

    if (recordsToExport.length === 0) {
      alert('No user records available to export.');
      return;
    }

    const excelData = recordsToExport.map((u, index) => ({
      'S.No': index + 1,
      'Employee ID': u.employeeId || 'N/A',
      'First Name': u.firstName,
      'Last Name': u.lastName,
      'Full Name': `${u.firstName} ${u.lastName}`,
      'Email Address': u.email,
      'Phone Number': u.phone || 'N/A',
      'Role': u.role,
      'Vehicle Number': u.defaultVehicleNumber || 'N/A',
      'Parking Category': u.allocatedLot ? u.allocatedCategory || 'Basement on GL' : 'Not Allocated',
      'Allocation Status': u.allocatedLot ? 'Allocated' : 'Unallocated',
      'Allocation Type': u.allocationType || (u.allocatedLot ? 'Permanent' : 'N/A'),
      'In Date (Temporary)': u.allocationType === 'Temporary' ? u.inDate || 'N/A' : 'N/A',
      'In Time (Temporary)': u.allocationType === 'Temporary' ? u.inTime || 'N/A' : 'N/A',
      'Out Date (Temporary)': u.allocationType === 'Temporary' ? u.outDate || 'N/A' : 'N/A',
      'Out Time (Temporary)': u.allocationType === 'Temporary' ? u.outTime || 'N/A' : 'N/A',
      'Allocation Timestamp': u.allocatedAt ? new Date(u.allocatedAt).toLocaleString() : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 15 }, // Employee ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 22 }, // Full Name
      { wch: 28 }, // Email
      { wch: 18 }, // Phone
      { wch: 14 }, // Role
      { wch: 18 }, // Vehicle
      { wch: 24 }, // Category
      { wch: 20 }, // Allocated Slot
      { wch: 12 }, // Status
      { wch: 16 }, // Allocation Type
      { wch: 18 }, // In Date
      { wch: 16 }, // In Time
      { wch: 18 }, // Out Date
      { wch: 16 }, // Out Time
      { wch: 24 }, // Timestamp
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Parking Allocations');

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `HDFC_Parking_Category_Allocations_${exportScope}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#002244] via-[#003366] to-[#002855] min-h-full pb-10 w-full min-w-0">
      {/* Top Header Bar */}
      <div className="bg-[#002855] text-white px-3 py-2.5 shadow-lg sticky top-0 z-40 w-full border-b border-blue-900/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Hamburger Button + Logo + Title + Active View Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl border border-white/20 shadow-xs flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
              aria-label="Open Navigation Menu"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="bg-white/95 p-1 rounded-md shadow-xs flex-shrink-0">
              <HdfcLogo size="sm" variant="full" />
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-black text-blue-100 bg-white/10 px-2 py-0.5 rounded-full border border-white/20 flex-shrink-0">
                Ｐａｒｋमि𝘵𝘳
              </span>

              {/* Current Active View Badge / Shortcut to open menu */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs font-black bg-blue-900/80 hover:bg-blue-800 text-blue-100 px-2.5 py-1 rounded-lg border border-blue-700/60 cursor-pointer transition-all truncate"
                title="Click to open menu and change module"
              >
                {activeModule === 'lots' && (
                  <>
                    <Layers className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                    <span className="truncate">{isEmployeeOnly ? 'Live Occupancy' : isSecurity ? 'View & Allocate' : '5 Categories'}</span>
                  </>
                )}
                {activeModule === 'create_bulk' && (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">Create & Upload</span>
                  </>
                )}
                {activeModule === 'roles' && (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                    <span className="truncate">Role Management</span>
                  </>
                )}
                {activeModule === 'reports' && (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
                    <span className="truncate">Reports</span>
                  </>
                )}
                {activeModule === 'my_pass' && (
                  <>
                    <QrCode className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                    <span className="truncate">{isEmployeeOnly ? 'My Digital Pass' : 'My Pass'}</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-blue-300 flex-shrink-0 opacity-75 ml-0.5" />
              </button>
            </div>
          </div>

          {/* Right: Role & Logout */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSuperAdmin ? (
              <span className="hidden xs:inline-flex bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest flex-shrink-0 items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> ADMIN
              </span>
            ) : isSecurity ? (
              <span className="hidden xs:inline-flex bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest flex-shrink-0 items-center gap-1">
                <Shield className="w-3 h-3 text-slate-950" /> SECURITY
              </span>
            ) : (
              <span className="hidden xs:inline-flex bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest flex-shrink-0 items-center gap-1">
                <Users className="w-3 h-3" /> EMPLOYEE
              </span>
            )}

            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Line 2: Compact Account info badge */}
        <div className="max-w-4xl mx-auto mt-2 flex items-center justify-between bg-blue-950/80 px-2.5 py-1 rounded-md border border-blue-800/60 text-[11px]">
          <span className="text-blue-200 font-medium truncate">
            Logged in as <strong className="text-white font-bold">{adminUser.firstName} {adminUser.lastName}</strong> ({adminUser.role || 'User'})
          </span>
          <span className="text-[10px] text-blue-300 font-mono flex-shrink-0 ml-2">{adminUser.email}</span>
        </div>
      </div>

      {/* Slide-Over Navigation Drawer (Hamburger Menu) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-84 max-w-[85vw] bg-[#001f3f] text-white h-full shadow-2xl flex flex-col justify-between border-r border-blue-800/80 z-10 animate-in slide-in-from-left duration-300 overflow-y-auto">
            {/* Top Drawer Header */}
            <div>
              <div className="p-4 bg-[#001830] border-b border-blue-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white p-1 rounded-md shadow-xs">
                    <HdfcLogo size="sm" variant="full" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white tracking-wide block">
                      Ｐａｒｋमि𝘵𝘳
                    </span>
                    <span className="text-[10px] text-blue-300 font-medium block">
                      Smart Parking Navigation
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Identity in Drawer */}
              <div className="p-4 bg-gradient-to-r from-blue-950 to-[#002244] border-b border-blue-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center font-black text-white text-sm shadow-md">
                    {adminUser.firstName?.[0] || 'U'}{adminUser.lastName?.[0] || 'S'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-xs text-white truncate">
                      {adminUser.firstName} {adminUser.lastName}
                    </h4>
                    <p className="text-[10px] text-blue-200 truncate">{adminUser.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[9px] font-bold">
                      {adminUser.role || 'User'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Navigation Options */}
              <div className="p-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-300/80 px-2 py-1">
                  Modules & Navigation
                </p>

                {/* Option 1: 5 Categories / Live Occupancy / View & Allocate */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('lots');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    activeModule === 'lots'
                      ? 'bg-[#1d4e89] text-white shadow-md border border-blue-400/50'
                      : 'text-blue-100 hover:bg-blue-900/50 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      activeModule === 'lots' ? 'bg-blue-500 text-white' : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                        <span>{isEmployeeOnly ? 'Live Occupancy' : isSecurity ? 'View & Allocate' : '5 Categories'}</span>
                        {activeModule === 'lots' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-blue-200/80 mt-0.5 truncate">
                        Capacity overview, live occupancy & slots
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activeModule === 'lots' ? 'text-blue-200' : 'text-blue-400/50'}`} />
                </button>

                {/* Option 2: Create & Bulk Upload (Super Admin) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('create_bulk');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      activeModule === 'create_bulk'
                        ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                        : 'text-blue-100 hover:bg-blue-900/50 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        activeModule === 'create_bulk' ? 'bg-emerald-500 text-white' : 'bg-blue-950 text-emerald-400 border border-blue-800'
                      }`}>
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                          <span>Create & Upload</span>
                          {activeModule === 'create_bulk' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[11px] text-blue-200/80 mt-0.5 truncate">
                          Individual user & bulk Excel (.xlsx) upload
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activeModule === 'create_bulk' ? 'text-emerald-200' : 'text-blue-400/50'}`} />
                  </button>
                )}

                {/* Option 3: Role Management (Super Admin) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('roles');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      activeModule === 'roles'
                        ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-300'
                        : 'text-blue-100 hover:bg-blue-900/50 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        activeModule === 'roles' ? 'bg-amber-400 text-slate-950' : 'bg-blue-950 text-amber-300 border border-blue-800'
                      }`}>
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                          <span>Role Management</span>
                          {activeModule === 'roles' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 truncate ${activeModule === 'roles' ? 'text-slate-900' : 'text-blue-200/80'}`}>
                          Assign roles, permissions & access codes
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activeModule === 'roles' ? 'text-slate-950' : 'text-blue-400/50'}`} />
                  </button>
                )}

                {/* Option 4: Reports (Super Admin) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('reports');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      activeModule === 'reports'
                        ? 'bg-cyan-600 text-white shadow-md border border-cyan-400'
                        : 'text-blue-100 hover:bg-blue-900/50 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        activeModule === 'reports' ? 'bg-cyan-500 text-white' : 'bg-blue-950 text-cyan-300 border border-blue-800'
                      }`}>
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                          <span>Reports & Analytics</span>
                          {activeModule === 'reports' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[11px] text-blue-200/80 mt-0.5 truncate">
                          Occupancy analytics, audit logs & Excel export
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activeModule === 'reports' ? 'text-cyan-200' : 'text-blue-400/50'}`} />
                  </button>
                )}

                {/* Option 5: My Digital Pass (All users) */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('my_pass');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    activeModule === 'my_pass'
                      ? 'bg-blue-600 text-white shadow-md border border-blue-300'
                      : 'text-blue-100 hover:bg-blue-900/50 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      activeModule === 'my_pass' ? 'bg-blue-500 text-white' : 'bg-blue-950 text-amber-300 border border-blue-800'
                    }`}>
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                        <span>{isEmployeeOnly ? 'My Digital Pass' : 'My Pass'}</span>
                        {activeModule === 'my_pass' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-blue-200/80 mt-0.5 truncate">
                        Personal digital QR pass & vehicle badge
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activeModule === 'my_pass' ? 'text-blue-200' : 'text-blue-400/50'}`} />
                </button>
              </div>
            </div>

            {/* Bottom Drawer Footer */}
            <div className="p-4 bg-[#001830] border-t border-blue-900/80 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
                className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout from Account</span>
              </button>

              <div className="text-center text-[10px] text-blue-300/70 font-medium">
                HDFC Bank • Ｐａｒｋमि𝘵𝘳 v2.0
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Dashboard Container */}
      <div className="max-w-4xl mx-auto w-full p-3 space-y-3.5 min-w-0">
        {activeModule === 'my_pass' ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-2">
            <UserQrDashboard
              user={adminUser}
              onLogout={onLogout}
              onUpdateUser={(updated) => handleUpdateSingleUser(updated)}
              hideHeader={true}
            />
          </div>
        ) : activeModule === 'create_bulk' ? (
          <CreateAndBulkUploadUsers
            allUsers={allUsersList}
            currentAdmin={adminUser}
            onAddNewUser={handleAddNewUserWithRole}
            onBulkAddUsers={handleBulkAddUsers}
          />
        ) : activeModule === 'roles' ? (
          <RoleManagement
            allUsers={allUsersList}
            currentAdmin={adminUser}
            onUpdateUserRole={handleUpdateUserRole}
            onAddNewUserWithRole={handleAddNewUserWithRole}
            onDeleteUser={handleDeleteUser}
            isSyncing={isSyncing}
            onSync={handleSyncList}
          />
        ) : activeModule === 'reports' ? (
          <ReportsModule
            allUsers={allUsersList}
            currentAdmin={adminUser}
          />
        ) : (
          <>
            {/* Master Overview Banner */}
            <div className="bg-gradient-to-r from-[#002855] to-[#1d4e89] text-white p-3.5 rounded-2xl shadow-sm border border-blue-900/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-widest">
                      Facility Parking Hub
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    5 Dedicated Parking Categories
                  </h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {isSuperAdmin
                      ? 'Configure slot capacities, view live occupancy, and allocate parking slots.'
                      : isSecurity
                      ? 'Browse live slot availability and allocate or release parking spots.'
                      : 'Browse live parking slot availability and view real-time occupancy.'}
                  </p>
                </div>

                {/* Aggregate Metrics */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
                    <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider block">
                      Total Slots
                    </span>
                    <span className="text-sm sm:text-base font-black text-white">{totalFacilitySlots}</span>
                  </div>

                  <div className="bg-emerald-500/20 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-emerald-400/30 text-center">
                    <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-wider block">
                      Total Free
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-300">{totalFacilityFree}</span>
                  </div>

                  <div className="bg-amber-500/20 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-400/30 text-center">
                    <span className="text-[9px] font-bold text-amber-200 uppercase tracking-wider block">
                      Allocated
                    </span>
                    <span className="text-sm sm:text-base font-black text-amber-300">{totalFacilityAllocated}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* THE 5 PARKING CATEGORIES CARDS (Requested 5-Category Layout) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-[#1d4e89] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-600" /> 5 Category Live Overview
                </span>
                <span className="text-[10px] text-gray-500 font-semibold">
                  Click any category to manage & allocate
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {categoryStats.map((stat) => {
                  const theme = getCategoryTheme(stat.category);

                  return (
                    <div
                      key={stat.category}
                      className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                    >
                      {/* Card Header with Category Title & Action */}
                      <div className={`p-3 border-b border-gray-100 ${theme.bgLight} flex items-start justify-between gap-2`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-lg text-white ${theme.accentBg} shadow-xs flex-shrink-0`}>
                            {getCategoryIcon(stat.category, 'w-4 h-4')}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">
                              Category
                            </span>
                            <h3 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                              {stat.category}
                            </h3>
                          </div>
                        </div>

                        {/* Super Admin Quick Create Slots Button */}
                        {isSuperAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategoryToSetCapacity(stat.category);
                              setCapacityInputVal(String(stat.total));
                              setCapacitySetError('');
                              setCapacitySetSuccess('');
                            }}
                            className="p-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 shadow-2xs cursor-pointer flex-shrink-0"
                            title={`Configure/create number of slots for ${stat.category}`}
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Set Slots</span>
                          </button>
                        )}
                      </div>

                      {/* Card Body - Metric Counters & Progress */}
                      <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block">Total</span>
                            <span className="text-xs sm:text-sm font-black text-gray-900">{stat.total}</span>
                          </div>

                          <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200">
                            <span className="text-[9px] font-bold text-amber-800 uppercase block">Allocated</span>
                            <span className="text-xs sm:text-sm font-black text-amber-900">{stat.allocated}</span>
                          </div>

                          <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                            <span className="text-[9px] font-bold text-emerald-800 uppercase block">Free</span>
                            <span className="text-xs sm:text-sm font-black text-emerald-800">{stat.free}</span>
                          </div>
                        </div>

                        {/* Visual Occupancy Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-gray-600 font-semibold">
                            <span>Occupancy ({stat.percent}%)</span>
                            <span className="text-emerald-700 font-bold">{stat.free} free slots</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200">
                            <div
                              className={`h-full transition-all duration-500 ${
                                stat.percent > 85 ? 'bg-red-500' : stat.percent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, stat.percent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Interactive Allocate Button (Visible for Admin and Security only) */}
                        {canAllocate && (
                          <div className="pt-1">
                            <button
                              onClick={() => {
                                handleOpenAllocationModal(undefined, stat.category);
                              }}
                              disabled={stat.free <= 0}
                              className={`w-full py-2 px-3 font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                                stat.free > 0
                                  ? 'bg-[#1d4e89] hover:bg-[#153b68] text-white active:scale-98'
                                  : 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
                              }`}
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>{stat.free > 0 ? '+ Allocate Slot' : 'Category Full (0 Free)'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUPER ADMIN POPUP: CREATE / SET SLOTS FOR A CATEGORY */}
            {categoryToSetCapacity && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-300 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-400 text-slate-950 rounded-lg">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest block">
                          Super Admin Slot Creator
                        </span>
                        <h3 className="text-sm font-black text-gray-900">
                          Create Slots: {categoryToSetCapacity}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setCategoryToSetCapacity(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCapacitySubmit} className="space-y-3.5">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                      Enter the total number of slots you want to create in <strong>{categoryToSetCapacity}</strong> (e.g. 100). Once created, users can be allocated slots within this category.
                    </div>

                    {capacitySetError && (
                      <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 font-bold">
                        {capacitySetError}
                      </div>
                    )}

                    {capacitySetSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        {capacitySetSuccess}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Number of Slots for {categoryToSetCapacity} *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={capacityInputVal}
                          onChange={(e) => setCapacityInputVal(e.target.value)}
                          placeholder="e.g. 100"
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1d4e89] focus:bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCategoryToSetCapacity(null)}
                        className="w-1/2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg border border-gray-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg shadow-md uppercase tracking-wider cursor-pointer"
                      >
                        Submit & Create Slots
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Quick Category Slot Inspector (Visible to Admin & Security Only) */}
            {/* Category Occupancy Overview (Visible to Admin & Security Only) */}
            {!isEmployeeOnly && (
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <h3 className="text-xs font-extrabold text-[#1d4e89] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-red-600 flex-shrink-0" /> Category Occupancy & Allocations
                  </h3>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    View occupancy & allocated users by category
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                      Select Category
                    </label>
                    <select
                      value={inspectCategory}
                      onChange={(e) => setInspectCategory(e.target.value as ParkingCategory)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                    >
                      {PARKING_CATEGORIES.map((cat) => {
                        const total = categoryCapacities[cat] || 100;
                        const occ = users.filter(
                          (u) =>
                            u.allocatedLot != null &&
                            (u.allocatedCategory === cat || (!u.allocatedCategory && cat === 'Basement on GL'))
                        ).length;
                        const free = Math.max(0, total - occ);
                        return (
                          <option key={cat} value={cat}>
                            {cat} ({free} free of {total})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    {canAllocate && (
                      <button
                        onClick={() => handleOpenAllocationModal(undefined, inspectCategory)}
                        className="w-full py-1.5 px-3 bg-[#1d4e89] hover:bg-[#153b68] text-white text-xs font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Allocate in {inspectCategory}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Summary & Allocated Users in this category */}
                <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2">
                  {(() => {
                    const total = categoryCapacities[inspectCategory] || 100;
                    const catUsers = users.filter(
                      (u) =>
                        u.allocatedLot != null &&
                        (u.allocatedCategory === inspectCategory || (!u.allocatedCategory && inspectCategory === 'Basement on GL'))
                    );
                    const free = Math.max(0, total - catUsers.length);

                    return (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[#1d4e89]">
                            {inspectCategory} ({catUsers.length} Allocated / {free} Free)
                          </span>
                          <span className="text-[11px] font-bold text-gray-600">
                            Total Capacity: {total}
                          </span>
                        </div>

                        {catUsers.length > 0 ? (
                          <div className="max-h-40 overflow-y-auto divide-y divide-gray-200 bg-white rounded-lg border border-blue-100 shadow-2xs">
                            {catUsers.map((u) => (
                              <div key={u.id} className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-gray-50">
                                <div className="min-w-0">
                                  <span className="font-extrabold text-gray-900 block truncate">
                                    {u.firstName} {u.lastName} <span className="font-mono text-red-600 font-bold ml-1">{u.defaultVehicleNumber || ''}</span>
                                  </span>
                                  <span className="text-[10px] text-gray-500 block truncate">
                                    {u.email} • {u.allocationType || 'Permanent'}
                                    {u.inTime ? ` (${u.inTime} - ${u.outTime || 'Open'})` : ''}
                                  </span>
                                </div>
                                {canAllocate && (
                                  <button
                                    onClick={() => handleReleaseLot(u.id)}
                                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] rounded cursor-pointer flex-shrink-0"
                                  >
                                    Release
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">
                            No employees currently allocated under "{inspectCategory}".
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Registered Users & Category Allocation Directory (Visible to Admin & Security Only) */}
            {!isEmployeeOnly && (
              <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden min-w-0">
                {/* Section Header */}
                <div className="bg-[#1d4e89] text-white p-3.5 flex flex-col gap-2.5">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-300 flex-shrink-0" />
                      User Directory & Category Allocations
                    </h2>
                    <p className="text-[10px] text-blue-100 mt-0.5">
                      Assign registered employees and visitors to any of the 5 parking categories.
                    </p>
                  </div>

                  <div className={`grid gap-2 pt-1 border-t border-blue-800/60 ${
                    isSuperAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
                  }`}>
                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => setActiveModule('create_bulk')}
                          className="py-1.5 px-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 border border-amber-300 cursor-pointer"
                          title="Create an individual employee or user account"
                        >
                          <UserPlus className="w-4 h-4 text-slate-950 flex-shrink-0" />
                          <span>+ Create</span>
                        </button>

                        <button
                          onClick={() => setActiveModule('create_bulk')}
                          className="py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 border border-emerald-300 cursor-pointer"
                          title="Upload users in bulk via Excel template"
                        >
                          <Upload className="w-4 h-4 text-slate-950 flex-shrink-0" />
                          <span>Bulk Upload</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleExportToExcel('all')}
                      className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 border border-emerald-500 cursor-pointer"
                      title="Download records in Microsoft Excel format"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-100 flex-shrink-0" />
                      <span>Export Excel</span>
                    </button>

                    <button
                      onClick={handleSyncList}
                      disabled={isSyncing}
                      className="py-1.5 px-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 disabled:opacity-60 cursor-pointer"
                      title="Refresh and sync the registered user directory"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-300' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync List'}</span>
                    </button>
                  </div>
                </div>

                {/* Sync Toast Feedback Banner */}
                {syncToast && (
                  <div className="bg-emerald-50 border-b border-emerald-200 px-3.5 py-2 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-xs truncate">{syncToast}</span>
                    </div>
                    <button
                      onClick={() => setSyncToast(null)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold text-xs flex-shrink-0 ml-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Search & Filter Controls */}
                <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2.5 min-w-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search registered user by name, email, phone, vehicle, category, or slot..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                    />
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full min-w-0">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all whitespace-nowrap flex-shrink-0 cursor-pointer ${
                        categoryFilter === 'all'
                          ? 'bg-[#1d4e89] text-white shadow-xs'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      All Categories
                    </button>
                    {PARKING_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-[#1d4e89] text-white shadow-xs'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full min-w-0">
                    {[
                      { id: 'all', label: `All (${users.length})` },
                      { id: 'allocated', label: `Allocated (${totalFacilityAllocated})` },
                      { id: 'unallocated', label: `Unallocated (${users.length - totalFacilityAllocated})` },
                      { id: 'permanent', label: `Permanent (${totalPermanent})` },
                      { id: 'temporary', label: `Temporary (${totalTemporary})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterType(tab.id as any)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all whitespace-nowrap flex-shrink-0 cursor-pointer ${
                          filterType === tab.id
                            ? 'bg-slate-800 text-white'
                            : 'bg-gray-200/80 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Users List */}
                <div className="divide-y divide-gray-200 min-w-0">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs">
                      No registered users found matching your search or category criteria.
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const isAllocated = user.allocatedLot != null || Boolean(user.allocatedCategory);
                      const catName = user.allocatedCategory || (user.allocatedLot != null ? 'Basement on GL' : 'Not Allocated');

                      return (
                        <div
                          key={user.id}
                          className="p-3.5 hover:bg-blue-50/30 transition-colors flex flex-col gap-2.5 min-w-0"
                        >
                          {/* User Header Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-extrabold text-sm text-gray-900 truncate">
                                {user.firstName} {user.lastName}
                              </span>
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 font-bold text-[10px] rounded border border-gray-200 flex-shrink-0">
                                {user.role}
                              </span>
                            </div>

                            {isAllocated ? (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-950 border border-blue-300 font-black text-xs rounded-lg shadow-2xs flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5 text-[#1d4e89]" />
                                  <span>{catName}</span>
                                </span>
                                <span
                                  className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                    user.allocationType === 'Temporary'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  }`}
                                >
                                  {user.allocationType || 'Permanent'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-semibold italic bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex-shrink-0">
                                Not Allocated
                              </span>
                            )}
                          </div>

                          {/* Contact & Vehicle Info Card */}
                          <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-200/80 text-xs text-gray-600 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-700 font-mono overflow-hidden">
                              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> {user.phone}
                              </span>
                              <span className="flex items-center gap-1 font-mono font-bold text-[#e41e26]">
                                <Car className="w-3.5 h-3.5 flex-shrink-0" /> {user.defaultVehicleNumber || 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Allocation Status & Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <div>
                              {isAllocated ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {user.allocationType === 'Temporary' && user.inTime ? (
                                    <span className="text-[10px] font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 flex-wrap">
                                      <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                      <span>
                                        In: {user.inDate ? `${user.inDate} ` : ''}{user.inTime} {user.outTime ? `• Out: ${user.outDate ? `${user.outDate} ` : ''}${user.outTime}` : '(Open)'}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-gray-500">
                                      Permanent in {catName}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">
                                  No category assigned
                                </span>
                              )}
                            </div>

                            {!isEmployeeOnly && (
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                                <button
                                  onClick={() => handleOpenAllocationModal(user)}
                                  className="px-2.5 py-1 bg-[#1d4e89] hover:bg-[#153b68] text-white text-xs font-bold rounded-md shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  {isAllocated ? 'Change' : 'Allocate'}
                                </button>

                                {isAllocated && (
                                  <button
                                    onClick={() => handleReleaseLot(user.id)}
                                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer"
                                    title={isSecurity && user.allocationType === 'Permanent' ? 'Permanent slot - Contact Admin for release' : 'Release allocation'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Release
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: ALLOCATE LOT TO USER (No Default User, Search / QR Code, 5 Categories, Auto Slot Assignment) */}
      {isAllocationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 my-auto shadow-2xl border border-gray-300 space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 flex-shrink-0">
              <div>
                <span className="text-[10px] font-extrabold text-[#1d4e89] uppercase tracking-widest block">
                  Category Parking Allocation
                </span>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  Allocate Parking Slot
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAllocationModalOpen(false);
                  setSelectedUserForAlloc(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error & Success Messages */}
            {allocError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 font-medium flex-shrink-0 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{allocError}</span>
              </div>
            )}

            {allocSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-bold flex items-center gap-1.5 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{allocSuccessMsg}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* SECTION 1: USER SELECTION (No user by default; Search with Name or Scan QR) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  1. Select User to Allocate *
                </label>

                {selectedUserForAlloc ? (
                  /* Selected User / Owner Details Card */
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border-2 border-[#1d4e89]/40 rounded-xl p-3.5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Owner Identified & Selected</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUserForAlloc(null)}
                        className="px-2.5 py-1 text-xs font-bold text-[#1d4e89] hover:bg-blue-100/80 rounded-lg border border-blue-300 transition-all flex-shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Change / Re-scan</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Owner Name</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-gray-900 truncate">
                            {selectedUserForAlloc.firstName} {selectedUserForAlloc.lastName}
                          </span>
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-900 font-black text-[9px] rounded border border-blue-200">
                            {selectedUserForAlloc.role}
                          </span>
                        </div>
                        {selectedUserForAlloc.employeeId && (
                          <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                            ID: {selectedUserForAlloc.employeeId}
                          </span>
                        )}
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Vehicle Plate</span>
                        <div className="mt-0.5">
                          <span className="text-xs font-black font-mono text-[#e41e26] uppercase block truncate">
                            {selectedUserForAlloc.defaultVehicleNumber || 'NOT SPECIFIED'}
                          </span>
                          <span className="text-[10px] text-gray-500 block truncate mt-0.5">
                            {selectedUserForAlloc.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/90 px-3 py-2 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
                      <span className="text-gray-600 font-medium">Current Status:</span>
                      {selectedUserForAlloc.allocatedLot != null ? (
                        <span className="font-bold text-blue-900">
                          Allocated under <span className="underline">{selectedUserForAlloc.allocatedCategory || 'Basement on GL'}</span> ({selectedUserForAlloc.allocationType || 'Permanent'})
                        </span>
                      ) : (
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Not Allocated Yet
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Search / QR Code Selection Interface */
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/60 p-3 space-y-3">
                    {/* Mode Switch Tabs */}
                    <div className="grid grid-cols-2 gap-1.5 bg-gray-200/80 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setAllocMethod('qr')}
                        className={`py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          allocMethod === 'qr'
                            ? 'bg-[#1d4e89] text-white shadow-xs'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/40'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Scan QR Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllocMethod('search')}
                        className={`py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          allocMethod === 'search'
                            ? 'bg-[#1d4e89] text-white shadow-xs'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/40'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Search by Name</span>
                      </button>
                    </div>

                    {/* Tab 1: Live QR Code Scanner */}
                    {allocMethod === 'qr' && (
                      <ModalQrScanner
                        users={users}
                        onUserIdentified={(matched) => {
                          setSelectedUserForAlloc(matched);
                          setAllocError('');
                        }}
                      />
                    )}

                    {/* Tab 2: Search by Name / Vehicle / Email */}
                    {allocMethod === 'search' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={allocUserSearchQuery}
                            onChange={(e) => setAllocUserSearchQuery(e.target.value)}
                            placeholder="Type employee name, vehicle, or email..."
                            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:border-[#1d4e89]"
                            autoFocus
                          />
                          {allocUserSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setAllocUserSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Matching Users List */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
                          {(() => {
                            const query = allocUserSearchQuery.toLowerCase().trim();
                            const matches = users.filter((u) => {
                              if (!query) return true;
                              const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
                              const email = (u.email || '').toLowerCase();
                              const vehicle = (u.defaultVehicleNumber || '').toLowerCase();
                              const empId = (u.employeeId || '').toLowerCase();
                              return (
                                fullName.includes(query) ||
                                email.includes(query) ||
                                vehicle.includes(query) ||
                                empId.includes(query)
                              );
                            });

                            if (matches.length === 0) {
                              return (
                                <div className="p-4 text-center text-xs text-gray-500">
                                  No user found matching "{allocUserSearchQuery}".
                                </div>
                              );
                            }

                            return matches.slice(0, 8).map((u) => {
                              const isAlloc = u.allocatedLot != null;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserForAlloc(u);
                                    setAllocError('');
                                  }}
                                  className="w-full p-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-extrabold text-gray-900 truncate">
                                        {u.firstName} {u.lastName}
                                      </span>
                                      <span className="text-[9px] font-bold text-gray-500 px-1 py-0.2 bg-gray-100 rounded">
                                        {u.role}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                                      <span>{u.email}</span>
                                      {u.defaultVehicleNumber && (
                                        <span className="font-mono font-bold text-red-600">
                                          {u.defaultVehicleNumber}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {isAlloc ? (
                                      <span
                                        className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-black rounded truncate max-w-[130px]"
                                        title={u.allocatedCategory || 'Basement on GL'}
                                      >
                                        {u.allocatedCategory || 'Basement on GL'}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                                        Unallocated
                                      </span>
                                    )}
                                    <span className="px-2 py-1 bg-[#1d4e89] hover:bg-[#153b68] text-white text-[11px] font-bold rounded shadow-2xs">
                                      Select
                                    </span>
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: CATEGORY SELECTION (5 Categories) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Select Category *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PARKING_CATEGORIES.map((cat) => {
                    const total = categoryCapacities[cat] || 100;
                    const occ = users.filter(
                      (u) =>
                        u.allocatedLot != null &&
                        (u.allocatedCategory === cat || (!u.allocatedCategory && cat === 'Basement on GL')) &&
                        u.id !== selectedUserForAlloc?.id
                    ).length;
                    const free = Math.max(0, total - occ);
                    const isFull = free <= 0;
                    const isSelected = allocCategory === cat;

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAllocCategory(cat)}
                        className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? isFull
                              ? 'bg-red-50 border-red-500 ring-2 ring-red-400/40 shadow-xs'
                              : 'bg-blue-50 border-[#1d4e89] ring-2 ring-[#1d4e89]/40 shadow-xs'
                            : isFull
                            ? 'bg-red-50/40 border-red-200 hover:bg-red-50/70'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isSelected ? (isFull ? 'bg-red-600 text-white' : 'bg-[#1d4e89] text-white') : isFull ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {getCategoryIcon(cat, 'w-3.5 h-3.5')}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-gray-900 block truncate">
                              {cat}
                            </span>
                            <span className={`text-[10px] font-bold block ${!isFull ? 'text-emerald-700' : 'text-red-600'}`}>
                              {!isFull ? `${free} free / ${total}` : `FULL (0 / ${total} free)`}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className={`w-4 h-4 flex-shrink-0 ml-1 ${isFull ? 'text-red-600' : 'text-[#1d4e89]'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: ALLOCATION TYPE (Permanent vs Temporary) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  3. Allocation Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocType('Permanent')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                      allocType === 'Permanent'
                        ? 'bg-[#1d4e89] text-white border-[#1d4e89] shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Permanent Slot
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocType('Temporary')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                      allocType === 'Temporary'
                        ? 'bg-[#1d4e89] text-white border-[#1d4e89] shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Temporary Slot
                  </button>
                </div>
              </div>

              {/* In Date/Time and Out Date/Time for Temporary Lots */}
              {allocType === 'Temporary' && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      Temporary Schedule (Date & Timings)
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      Auto-Captured
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" /> In Date *
                      </label>
                      <input
                        type="text"
                        value={allocInDate}
                        onChange={(e) => setAllocInDate(e.target.value)}
                        placeholder="e.g. 18 Aug 2026"
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" /> In Time *
                      </label>
                      <input
                        type="text"
                        value={allocInTime}
                        onChange={(e) => setAllocInTime(e.target.value)}
                        placeholder="e.g. 09:00 AM"
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Out Date (Optional)
                      </label>
                      <input
                        type="text"
                        value={allocOutDate}
                        onChange={(e) => setAllocOutDate(e.target.value)}
                        placeholder="e.g. 18 Aug 2026"
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Out Time (Optional)
                      </label>
                      <input
                        type="text"
                        value={allocOutTime}
                        onChange={(e) => setAllocOutTime(e.target.value)}
                        placeholder="e.g. 06:00 PM"
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1d4e89]"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-amber-800 leading-tight">
                    * Out date and time are recorded upon release during gate checkout.
                  </p>
                </div>
              )}

              {/* LIVE CAPACITY / VALIDATION FEEDBACK BANNER */}
              {(() => {
                const total = categoryCapacities[allocCategory] || 100;
                const occ = users.filter(
                  (u) =>
                    u.allocatedLot != null &&
                    (u.allocatedCategory === allocCategory || (!u.allocatedCategory && allocCategory === 'Basement on GL')) &&
                    u.id !== selectedUserForAlloc?.id
                ).length;
                const free = Math.max(0, total - occ);
                const isFull = free <= 0;

                if (isFull) {
                  return (
                    <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-start gap-2.5 animate-in fade-in">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-red-800 leading-snug">
                        <strong className="font-black text-red-900 block mb-0.5">
                          Capacity Limit Reached (0 Free Slots)
                        </strong>
                        "{allocCategory}" is at maximum capacity ({occ}/{total} slots occupied). The system prevents allocating more than available slots. Please select another category.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-700 leading-snug">
                      <span className="font-bold text-slate-900 block">
                        Auto-Slot Assignment:
                      </span>
                      Submitting will assign the next available slot in <strong>{allocCategory}</strong> ({free} free remaining of {total}) and update counters.
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Submit Controls (Fixed Footer) */}
            {(() => {
              const total = categoryCapacities[allocCategory] || 100;
              const occ = users.filter(
                (u) =>
                  u.allocatedLot != null &&
                  (u.allocatedCategory === allocCategory || (!u.allocatedCategory && allocCategory === 'Basement on GL')) &&
                  u.id !== selectedUserForAlloc?.id
              ).length;
              const isFull = (total - occ) <= 0;
              const canSubmit = !isFull && selectedUserForAlloc != null;

              return (
                <div className="pt-2 border-t border-gray-200 flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAllocationModalOpen(false);
                      setSelectedUserForAlloc(null);
                    }}
                    className="w-1/2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg border border-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAllocation}
                    disabled={!canSubmit}
                    className={`w-1/2 py-2.5 font-bold text-xs rounded-lg shadow-md uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      !canSubmit
                        ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                        : 'bg-[#1d4e89] hover:bg-[#153b68] text-white cursor-pointer active:scale-98'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{isFull ? 'Category Full (0 Free)' : 'Confirm Allocation'}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: MANDATORY OUT TIME ON TEMPORARY LOT RELEASE */}
      {userToRelease && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-300 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block">
                  Mandatory Exit Recording
                </span>
                <h3 className="text-base font-black text-[#1d4e89]">
                  Release Temporary Allocation ({userToRelease.allocatedCategory || 'Basement on GL'})
                </h3>
              </div>
              <button
                onClick={() => setUserToRelease(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Details */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <span className="text-xs font-black text-gray-900 block">
                User: {userToRelease.firstName} {userToRelease.lastName}
              </span>
              <span className="text-[11px] text-gray-600 block">
                {userToRelease.email} • {userToRelease.phone}
              </span>
              <span className="text-[11px] font-bold text-[#e41e26] block">
                Vehicle: {userToRelease.defaultVehicleNumber || 'N/A'}
              </span>
              <span className="text-[11px] font-bold text-blue-900 block">
                Category: {userToRelease.allocatedCategory || 'Basement on GL'}
              </span>
              {userToRelease.inTime && (
                <div className="text-[11px] font-bold text-amber-900 pt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                  <span>
                    Check-In (In Date & Time): {userToRelease.inDate ? `${userToRelease.inDate} • ` : ''}{userToRelease.inTime}
                  </span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {releaseError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 font-bold">
                {releaseError}
              </div>
            )}

            {/* Release Form */}
            <form onSubmit={handleConfirmReleaseTemporary} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Auto-Recorded Out Date & Time <span className="text-red-600">* Mandatory</span>
                  </label>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-500" /> Locked System Clock
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={releaseOutDate}
                      readOnly
                      className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm font-black font-mono text-gray-900 focus:outline-none cursor-not-allowed select-none shadow-inner"
                      title="Out Date"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={releaseOutTime}
                      readOnly
                      className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm font-black font-mono text-gray-900 focus:outline-none cursor-not-allowed select-none shadow-inner"
                      title="Out Time"
                      required
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Recorded
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span>The exit date and time are automatically timestamped from the live system clock and cannot be edited to maintain audit integrity.</span>
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setUserToRelease(null)}
                  className="w-1/2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-md uppercase tracking-wider cursor-pointer"
                >
                  Confirm & Release Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SECURITY RESTRICTION ALERT FOR PERMANENT SLOTS */}
      {permanentDeniedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-red-300 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block">
                    Security Restriction
                  </span>
                  <h3 className="text-base font-black text-gray-900">
                    Permanent Slot Release Restricted
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPermanentDeniedUser(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Details */}
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1 text-xs">
              <div className="font-extrabold text-red-950 text-sm">
                {permanentDeniedUser.firstName} {permanentDeniedUser.lastName}
              </div>
              <div className="text-gray-700 flex items-center justify-between">
                <span>Category: <strong className="text-blue-900">{permanentDeniedUser.allocatedCategory || 'Basement on GL'}</strong></span>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] uppercase border border-red-200">
                  Permanent
                </span>
              </div>
              <div className="text-gray-600 font-mono text-[11px] pt-0.5">
                {permanentDeniedUser.email} • {permanentDeniedUser.phone}
              </div>
              <div className="text-[#e41e26] font-mono font-bold text-[11px]">
                Vehicle: {permanentDeniedUser.defaultVehicleNumber || 'N/A'}
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                <strong className="font-bold text-amber-900 block mb-1">
                  The user is allocated a permanent slot. Please contact Admin for release.
                </strong>
                Security is strictly authorized to release <strong>temporary slots</strong> only with mandatory Out Time recording. Permanent allocations can only be released by an <strong>Admin Super User</strong>.
              </div>
            </div>

            {/* Dismiss Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setPermanentDeniedUser(null)}
                className="w-full py-2.5 bg-[#002855] hover:bg-[#001f42] text-white font-bold text-xs rounded-xl shadow-md uppercase tracking-wider cursor-pointer"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
