import React, { useState, useEffect } from 'react';
import { User, ParkingSpot, ParkingZone, Branch, Booking } from './types';
import { INITIAL_USER, MOCK_BRANCHES, generateFloorSpots, INITIAL_BOOKINGS } from './data/mockData';
import {
  seedInitialUsers,
  seedInitialBookings,
  subscribeToUsers,
  subscribeToBookings,
  deduplicateUsersList,
} from './lib/firebase';
import { MobileFrame } from './components/MobileFrame';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ActiveTicketCard } from './components/parking/ActiveTicketCard';
import { ParkingMap } from './components/parking/ParkingMap';
import { AutoAllocateModal } from './components/parking/AutoAllocateModal';
import { BookingHistory } from './components/parking/BookingHistory';
import { VehicleLocator } from './components/parking/VehicleLocator';
import { UserProfile } from './components/profile/UserProfile';
import { UserQrDashboard } from './components/profile/UserQrDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { HdfcLogo } from './components/HdfcLogo';
import {
  Home,
  MapPin,
  Clock,
  User as UserIcon,
  Sparkles,
  Building2,
  Car,
  Zap,
  PlusCircle,
  Footprints,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'authenticated'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [prefillEmail, setPrefillEmail] = useState('');
  const [registrationSuccessMsg, setRegistrationSuccessMsg] = useState('');

  // Active Branch & Zones State
  const [selectedBranch, setSelectedBranch] = useState<Branch>(MOCK_BRANCHES[0]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(MOCK_BRANCHES[0].zones[0].id);

  // Spots State
  const [spots, setSpots] = useState<ParkingSpot[]>(() => {
    return generateFloorSpots('zn_b1', 'B1');
  });

  // Bookings State
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);

  // Modals & Active Tab State
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'locator' | 'history' | 'profile'>('home');
  const [showAutoAllocateModal, setShowAutoAllocateModal] = useState(false);

  // Initialize Firestore seeding and persistent session listener
  useEffect(() => {
    seedInitialUsers();
    seedInitialBookings();

    const savedUser = localStorage.getItem('hdfc_active_session');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setAuthScreen('authenticated');
      } catch (e) {
        console.error(e);
      }
    }

    // Subscribe to users real-time stream to sync current user session live
    const unsubUsers = subscribeToUsers((allUsers) => {
      if (allUsers && allUsers.length > 0) {
        const deduplicated = deduplicateUsersList(allUsers);
        localStorage.setItem('hdfc_parking_users', JSON.stringify(deduplicated));
        
        // If current user is logged in, keep their user state fresh
        const savedSessionRaw = localStorage.getItem('hdfc_active_session');
        if (savedSessionRaw) {
          try {
            const activeSession = JSON.parse(savedSessionRaw);
            const fresh = deduplicated.find((u) => u.email.toLowerCase() === activeSession.email.toLowerCase());
            if (fresh) {
              setCurrentUser(fresh);
              localStorage.setItem('hdfc_active_session', JSON.stringify(fresh));
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    });

    const unsubBookings = subscribeToBookings((allBookings) => {
      if (allBookings && allBookings.length > 0) {
        setBookings(allBookings);
      }
    });

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubBookings) unsubBookings();
    };
  }, []);

  // Sync floor spots when zone changes
  useEffect(() => {
    const activeZone = selectedBranch.zones.find((z) => z.id === selectedZoneId);
    if (activeZone) {
      setSpots(generateFloorSpots(activeZone.id, activeZone.code));
    }
  }, [selectedZoneId, selectedBranch]);

  // Handle Login Success
  const handleLoginSuccess = (email: string) => {
    // Check registered user in storage or construct standard user profile
    const registeredUsersRaw = localStorage.getItem('hdfc_parking_users');
    let foundUser: User | null = null;
    if (registeredUsersRaw) {
      try {
        const users = JSON.parse(registeredUsersRaw);
        foundUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      } catch (err) {
        console.error(err);
      }
    }

    const userObj: User = foundUser || {
      ...INITIAL_USER,
      email: email,
    };

    setCurrentUser(userObj);
    localStorage.setItem('hdfc_active_session', JSON.stringify(userObj));
    setAuthScreen('authenticated');
  };

  // Handle Register Success
  const handleRegisterSuccess = (registeredEmail: string, registeredFirstName: string) => {
    setPrefillEmail(registeredEmail);
    setRegistrationSuccessMsg(
      `Welcome ${registeredFirstName}! Account created for ${registeredEmail}. Please sign in below.`
    );
    setAuthScreen('login');
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('hdfc_active_session');
    setCurrentUser(null);
    setAuthScreen('login');
    setActiveTab('home');
  };

  // Active Booking
  const activeBooking = bookings.find((b) => b.status === 'active');

  // Booking Actions
  const handleReleaseSpot = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed' as const } : b))
    );
  };

  const handleExtendBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          const currentEnd = new Date(b.endTime).getTime();
          const newEnd = new Date(currentEnd + 60 * 60 * 1000).toISOString();
          return { ...b, endTime: newEnd };
        }
        return b;
      })
    );
    alert('Parking Pass extended by +1 Hour.');
  };

  const handleConfirmNewAllocation = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
    setShowAutoAllocateModal(false);
    setActiveTab('home');

    // Update spot status
    setSpots((prev) =>
      prev.map((s) => (s.code === newBooking.spotCode ? { ...s, status: 'occupied' } : s))
    );
  };

  return (
    <MobileFrame activeTabTitle={activeTab} userEmail={currentUser?.email}>
      {/* 1. LOGIN SCREEN */}
      {authScreen === 'login' && (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onNavigateRegister={() => {
            setRegistrationSuccessMsg('');
            setAuthScreen('register');
          }}
          prefillEmail={prefillEmail}
          registrationSuccessMsg={registrationSuccessMsg}
        />
      )}

      {/* 2. REGISTER SCREEN */}
      {authScreen === 'register' && (
        <RegisterForm
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateLogin={() => setAuthScreen('login')}
        />
      )}

      {/* 3. AUTHENTICATED USER DASHBOARD (Admin, Security, Employee - FTE) */}
      {authScreen === 'authenticated' && currentUser && (
        <AdminDashboard
          adminUser={currentUser}
          onLogout={handleLogout}
        />
      )}
    </MobileFrame>
  );
}
