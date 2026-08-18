export type UserRole = 'Admin Super User' | 'Employee - FTE' | 'Security' | 'Admin' | 'Employee' | 'Executive' | 'Visitor';

export type ParkingCategory =
  | 'Underground Basement'
  | 'Basement on GL'
  | 'Open'
  | 'Visitor'
  | 'Stackup/Down';

export const PARKING_CATEGORIES: ParkingCategory[] = [
  'Underground Basement',
  'Basement on GL',
  'Open',
  'Visitor',
  'Stackup/Down',
];

export const DEFAULT_CATEGORY_CAPACITIES: Record<ParkingCategory, number> = {
  'Underground Basement': 100,
  'Basement on GL': 100,
  'Open': 100,
  'Visitor': 100,
  'Stackup/Down': 100,
};

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessCode?: string; // Unique login access code (e.g. HPK-1001, ADM-2026)
  password?: string;
  role: 'Admin Super User' | 'Employee - FTE' | 'Security' | 'Admin' | 'Employee' | 'Executive' | 'Visitor';
  employeeId?: string;
  defaultVehicleNumber?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  allocatedCategory?: ParkingCategory | string | null;
  allocatedLot?: number | null; // Slot number within category
  allocationType?: 'Permanent' | 'Temporary' | null;
  inDate?: string | null;
  inTime?: string | null;
  outDate?: string | null;
  outTime?: string | null;
  allocatedAt?: string | null;
  registeredAt?: string | null;
}

export type SpotType = 'Standard' | 'Executive' | 'EV Charging' | 'Accessible' | 'Two-Wheeler';
export type SpotStatus = 'available' | 'occupied' | 'reserved' | 'selected';

export interface ParkingSpot {
  id: string;
  code: string; // e.g., B1-A12
  floorId: string;
  type: SpotType;
  status: SpotStatus;
  nearElevator?: boolean;
  hasEvCharger?: boolean;
  occupantVehicle?: string;
  hourlyRate?: number;
}

export interface ParkingZone {
  id: string;
  name: string; // e.g., Basement 1 (Executive & EV), Basement 2 (Staff)
  code: string;
  totalSpots: number;
  availableSpots: number;
  evSpots: number;
  accessibleSpots: number;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  totalFloors: number;
  zones: ParkingZone[];
}

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  spotId: string;
  spotCode: string;
  zoneName: string;
  floorName: string;
  branchName: string;
  vehicleNumber: string;
  vehicleType: 'Sedan' | 'SUV' | 'Hatchback' | 'Two-Wheeler' | 'EV';
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: 'active' | 'completed' | 'cancelled';
  qrCode: string;
  pillarLocation: string;
}

export interface ParkingActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone: string;
  vehicleNumber: string;
  category: ParkingCategory | string;
  slotNumber: number | null;
  allocationType: 'Permanent' | 'Temporary';
  inDate: string;
  inTime: string;
  outDate?: string | null;
  outTime?: string | null;
  status: 'Active' | 'Released' | 'Completed';
  actionType: 'Allocated' | 'Released' | 'Updated';
  timestamp: string; // ISO string
  actionBy?: string;
}
