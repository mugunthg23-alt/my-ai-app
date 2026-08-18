import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Booking, ParkingActivityLog } from '../types';
import { sanitizeVehicleNumber } from './validation';

// Silence verbose internal connection probing messages from Firestore in sandboxed iframe environments
setLogLevel('silent');

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured databaseId and long polling
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  firestoreDb = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreDb;

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };

  // Only log if not a transient offline/connecting state
  if (!errMessage.includes('unavailable') && !errMessage.includes('offline') && !errMessage.includes('client is offline')) {
    console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  }
  return errInfo;
}

const USERS_COLLECTION = 'users';
const BOOKINGS_COLLECTION = 'bookings';

export const normalizeUserRole = (role?: string, email?: string): 'Admin Super User' | 'Employee - FTE' | 'Security' => {
  if (email && email.toLowerCase().trim() === 'mugunth.g23@gmail.com') return 'Admin Super User';
  if (!role) return 'Employee - FTE';
  const r = role.toLowerCase().trim();
  if (r.includes('admin') || r.includes('super')) return 'Admin Super User';
  if (r.includes('sec') || r.includes('guard')) return 'Security';
  return 'Employee - FTE';
};

// Helper: Generate unique access code for user login
export const generateUniqueAccessCode = (prefix = 'HPK'): string => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
};

// Initial seed users
const INITIAL_DEMO_USERS: User[] = [
  {
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
    allocatedLot: null,
    allocationType: null,
    inTime: null,
    outTime: null,
  },
  {
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
    accessCode: 'HPK-8924',
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
    accessCode: 'HPK-1001',
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

// Initial seed bookings
const INITIAL_DEMO_BOOKINGS: Booking[] = [
  {
    id: 'bk_109283',
    userId: 'usr_demo_1',
    userName: 'Arnav Sharma',
    userEmail: 'arnav.sharma@email.com',
    spotId: 'spot_zn_b1_B1-A04',
    spotCode: 'B1-A04',
    zoneName: 'Basement 1 (Executive & VIP)',
    floorName: 'Basement Level 1',
    branchName: 'HDFC Bank House - Corporate HQ',
    vehicleNumber: 'MH 02 CP 4821',
    vehicleType: 'Sedan',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    qrCode: 'HDFC-PARK-PASS-89241-B1A04',
    pillarLocation: 'Pillar B1-Red (#04) near Elevator Bank 2',
  },
];

/**
 * Generate a deterministic Firestore document ID based on user email
 */
export const getUserDocId = (userOrEmail: User | string): string => {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail.email;
  if (!email) return `usr_${Date.now()}`;
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'mugunth.g23@gmail.com') return 'usr_admin_1';
  if (cleanEmail === 'arnav.sharma@email.com') return 'usr_demo_1';
  if (cleanEmail === 'employee@hdfcbank.com') return 'usr_demo_3';
  return `usr_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;
};

/**
 * Deduplicate users array strictly by email address (case-insensitive)
 */
export const deduplicateUsersList = (users: User[]): User[] => {
  if (!Array.isArray(users)) return [];
  const map = new Map<string, User>();

  for (const u of users) {
    if (!u || !u.email) continue;
    const cleanEmail = u.email.toLowerCase().trim();
    if (!cleanEmail) continue;

    const standardizedDocId = getUserDocId(cleanEmail);
    const resolvedRole = normalizeUserRole(u.role, cleanEmail);
    const resolvedAdmin = resolvedRole === 'Admin Super User' || cleanEmail === 'mugunth.g23@gmail.com';
    let resolvedAccessCode = u.accessCode;
    if (!resolvedAccessCode) {
      if (cleanEmail === 'mugunth.g23@gmail.com') resolvedAccessCode = 'ADM-2026';
      else if (cleanEmail === 'security@hdfcbank.com') resolvedAccessCode = 'SEC-1001';
      else if (cleanEmail === 'arnav.sharma@email.com') resolvedAccessCode = 'HPK-8924';
      else if (cleanEmail === 'employee@hdfcbank.com') resolvedAccessCode = 'HPK-1001';
      else resolvedAccessCode = generateUniqueAccessCode('HPK');
    }

    const normalizedUser: User = {
      ...u,
      id: u.id && u.id.startsWith('usr_') && !u.id.includes('undefined') ? u.id : standardizedDocId,
      email: cleanEmail,
      firstName: u.firstName ? u.firstName.trim() : '',
      lastName: u.lastName ? u.lastName.trim() : '',
      accessCode: resolvedAccessCode,
      role: resolvedRole,
      isAdmin: resolvedAdmin,
      defaultVehicleNumber: u.defaultVehicleNumber ? sanitizeVehicleNumber(u.defaultVehicleNumber) : '',
    };

    if (!map.has(cleanEmail)) {
      map.set(cleanEmail, normalizedUser);
    } else {
      const existing = map.get(cleanEmail)!;
      // Merge records preserving allocation if set
      const mergedRole = normalizeUserRole(normalizedUser.role || existing.role, cleanEmail);
      const merged: User = {
        ...existing,
        ...normalizedUser,
        id: existing.id || normalizedUser.id,
        accessCode: normalizedUser.accessCode || existing.accessCode || resolvedAccessCode,
        allocatedLot:
          normalizedUser.allocatedLot !== null && normalizedUser.allocatedLot !== undefined
            ? normalizedUser.allocatedLot
            : existing.allocatedLot,
        allocationType: normalizedUser.allocationType || existing.allocationType,
        inTime: normalizedUser.inTime || existing.inTime,
        outTime: normalizedUser.outTime || existing.outTime,
        role: mergedRole,
        isAdmin: mergedRole === 'Admin Super User' || cleanEmail === 'mugunth.g23@gmail.com',
      };
      map.set(cleanEmail, merged);
    }
  }

  return Array.from(map.values());
};

/**
 * Real-time listener for users collection in Firestore with automatic deduplication
 */
export const subscribeToUsers = (
  onUsersUpdate: (users: User[]) => void,
  onError?: (err: any) => void
) => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    return onSnapshot(
      usersRef,
      (snapshot) => {
        if (snapshot.empty) {
          // Seed initial data if database is empty
          seedInitialUsers().then(() => {
            // Snapshot will fire again after seeding
          });
          return;
        }

        const rawUsersList: User[] = [];
        const seenDocIdsByEmail = new Map<string, string[]>();

        snapshot.forEach((docSnap) => {
          const u = docSnap.data() as User;
          if (u && u.email) {
            rawUsersList.push(u);
            const em = u.email.toLowerCase().trim();
            const docs = seenDocIdsByEmail.get(em) || [];
            docs.push(docSnap.id);
            seenDocIdsByEmail.set(em, docs);
          }
        });

        // Automatically clean up multiple duplicate documents in Firestore
        seenDocIdsByEmail.forEach((docIds, email) => {
          if (docIds.length > 1) {
            const canonicalId = getUserDocId(email);
            docIds.forEach((docId) => {
              if (docId !== canonicalId) {
                deleteDoc(doc(db, USERS_COLLECTION, docId)).catch(() => {});
              }
            });
          }
        });

        const deduplicated = deduplicateUsersList(rawUsersList);
        onUsersUpdate(deduplicated);
      },
      (error) => {
        console.warn('Firestore user subscription error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Firestore initialize failed:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Real-time listener for bookings collection in Firestore
 */
export const subscribeToBookings = (
  onBookingsUpdate: (bookings: Booking[]) => void,
  onError?: (err: any) => void
) => {
  try {
    const bookingsRef = collection(db, BOOKINGS_COLLECTION);
    return onSnapshot(
      bookingsRef,
      (snapshot) => {
        if (snapshot.empty) {
          seedInitialBookings();
          return;
        }

        const bookingsList: Booking[] = [];
        snapshot.forEach((docSnap) => {
          bookingsList.push(docSnap.data() as Booking);
        });

        onBookingsUpdate(bookingsList);
      },
      (error) => {
        console.warn('Firestore booking subscription error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Firestore booking sub error:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Save or update a single user in Firestore
 */
export const saveUserToFirestore = async (user: User) => {
  try {
    const docId = getUserDocId(user);
    const userToSave = { ...user, id: docId, email: user.email.toLowerCase().trim() };
    const userRef = doc(db, USERS_COLLECTION, docId);
    await setDoc(userRef, userToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${USERS_COLLECTION}/${user.id}`);
  }
};

/**
 * Delete a user from Firestore
 */
export const deleteUserFromFirestore = async (userIdOrEmail: string) => {
  try {
    const docId = userIdOrEmail.includes('@') ? getUserDocId(userIdOrEmail) : userIdOrEmail;
    const userRef = doc(db, USERS_COLLECTION, docId);
    await deleteDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${USERS_COLLECTION}/${userIdOrEmail}`);
  }
};

/**
 * Batch update users list in Firestore with deterministic document IDs and deduplication
 */
export const saveUsersBatchToFirestore = async (usersList: User[]) => {
  try {
    const deduplicated = deduplicateUsersList(usersList);
    const promises = deduplicated.map((user) => {
      const docId = getUserDocId(user);
      const userToSave = { ...user, id: docId, email: user.email.toLowerCase().trim() };
      const userRef = doc(db, USERS_COLLECTION, docId);
      return setDoc(userRef, userToSave, { merge: true });
    });
    await Promise.all(promises);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, USERS_COLLECTION);
  }
};

/**
 * Save or update a booking in Firestore
 */
export const saveBookingToFirestore = async (booking: Booking) => {
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, booking.id);
    await setDoc(bookingRef, booking, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${BOOKINGS_COLLECTION}/${booking.id}`);
  }
};

/**
 * Seed initial users if Firestore collection is empty
 */
export const seedInitialUsers = async () => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);
    if (snap.empty) {
      for (const u of INITIAL_DEMO_USERS) {
        await setDoc(doc(db, USERS_COLLECTION, u.id), u, { merge: true });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, USERS_COLLECTION);
  }
};

/**
 * Seed initial bookings if Firestore collection is empty
 */
export const seedInitialBookings = async () => {
  try {
    const bookingsRef = collection(db, BOOKINGS_COLLECTION);
    const snap = await getDocs(bookingsRef);
    if (snap.empty) {
      for (const b of INITIAL_DEMO_BOOKINGS) {
        await setDoc(doc(db, BOOKINGS_COLLECTION, b.id), b, { merge: true });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, BOOKINGS_COLLECTION);
  }
};

const LOGS_COLLECTION = 'parking_logs';

export const INITIAL_DEMO_LOGS: ParkingActivityLog[] = [
  {
    id: 'log_seed_1',
    userId: 'usr_demo_1',
    userName: 'Arnav Sharma',
    userEmail: 'arnav.sharma@email.com',
    phone: '+91 98765 43210',
    vehicleNumber: 'MH02CP4821',
    category: 'Basement on GL',
    slotNumber: 42,
    allocationType: 'Permanent',
    inDate: '18 Aug 2026',
    inTime: '08:45 AM',
    outDate: null,
    outTime: null,
    status: 'Active',
    actionType: 'Allocated',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    actionBy: 'Admin Super User',
  },
  {
    id: 'log_seed_2',
    userId: 'usr_demo_3',
    userName: 'HDFC Employee',
    userEmail: 'employee@hdfcbank.com',
    phone: '+91 98765 00000',
    vehicleNumber: 'MH01AB1234',
    category: 'Underground Basement',
    slotNumber: 10,
    allocationType: 'Temporary',
    inDate: '18 Aug 2026',
    inTime: '09:00 AM',
    outDate: null,
    outTime: null,
    status: 'Active',
    actionType: 'Allocated',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    actionBy: 'Security Officer',
  },
  {
    id: 'log_seed_3',
    userId: 'usr_past_1',
    userName: 'Rahul Verma',
    userEmail: 'rahul.verma@hdfcbank.com',
    phone: '+91 98111 22334',
    vehicleNumber: 'DL01XY9988',
    category: 'Visitor',
    slotNumber: 5,
    allocationType: 'Temporary',
    inDate: '18 Aug 2026',
    inTime: '09:30 AM',
    outDate: '18 Aug 2026',
    outTime: '01:45 PM',
    status: 'Released',
    actionType: 'Released',
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    actionBy: 'Security Officer',
  },
  {
    id: 'log_seed_4',
    userId: 'usr_past_2',
    userName: 'Pooja Iyer',
    userEmail: 'pooja.iyer@hdfcbank.com',
    phone: '+91 97222 33445',
    vehicleNumber: 'KA03MN4567',
    category: 'Open',
    slotNumber: 14,
    allocationType: 'Temporary',
    inDate: '17 Aug 2026',
    inTime: '10:15 AM',
    outDate: '17 Aug 2026',
    outTime: '06:30 PM',
    status: 'Released',
    actionType: 'Released',
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    actionBy: 'Admin Super User',
  },
];

/**
 * Real-time listener for parking activity logs collection in Firestore
 */
export const subscribeToActivityLogs = (
  onLogsUpdate: (logs: ParkingActivityLog[]) => void,
  onError?: (err: any) => void
) => {
  try {
    const logsRef = collection(db, LOGS_COLLECTION);
    return onSnapshot(
      logsRef,
      (snapshot) => {
        if (snapshot.empty) {
          seedInitialActivityLogs();
          return;
        }

        const logsList: ParkingActivityLog[] = [];
        snapshot.forEach((docSnap) => {
          logsList.push(docSnap.data() as ParkingActivityLog);
        });

        // Sort latest first
        logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onLogsUpdate(logsList);
      },
      (error) => {
        console.warn('Firestore logs subscription error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Firestore logs sub error:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Save or record an activity log in Firestore
 */
export const saveActivityLogToFirestore = async (log: ParkingActivityLog) => {
  try {
    const logRef = doc(db, LOGS_COLLECTION, log.id);
    await setDoc(logRef, log, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${LOGS_COLLECTION}/${log.id}`);
  }
};

/**
 * Seed initial activity logs if Firestore collection is empty
 */
export const seedInitialActivityLogs = async () => {
  try {
    const logsRef = collection(db, LOGS_COLLECTION);
    const snap = await getDocs(logsRef);
    if (snap.empty) {
      for (const l of INITIAL_DEMO_LOGS) {
        await setDoc(doc(db, LOGS_COLLECTION, l.id), l, { merge: true });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LOGS_COLLECTION);
  }
};
