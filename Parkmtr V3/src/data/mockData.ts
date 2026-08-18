import { Branch, ParkingSpot, User, Booking } from '../types';

export const INITIAL_USER: User = {
  id: 'usr_default',
  firstName: 'Arnav',
  lastName: 'Sharma',
  email: 'arnav.sharma@email.com',
  phone: '+91 98765 43210',
  role: 'Employee - FTE',
  employeeId: 'HDFC-89241',
  defaultVehicleNumber: 'MH02CP4821',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
};

export const MOCK_BRANCHES: Branch[] = [
  {
    id: 'br_mumbai_hq',
    name: 'HDFC Bank House - Corporate HQ',
    city: 'Mumbai',
    address: 'HDFC Bank House, Senapati Bapat Marg, Lower Parel, Mumbai - 400013',
    totalFloors: 3,
    zones: [
      {
        id: 'zn_b1',
        name: 'Basement 1 (Executive & VIP)',
        code: 'B1',
        totalSpots: 24,
        availableSpots: 10,
        evSpots: 6,
        accessibleSpots: 4,
      },
      {
        id: 'zn_b2',
        name: 'Basement 2 (Staff & Daily Pass)',
        code: 'B2',
        totalSpots: 36,
        availableSpots: 18,
        evSpots: 4,
        accessibleSpots: 4,
      },
      {
        id: 'zn_g1',
        name: 'Ground Level (Visitors & Quick Access)',
        code: 'G',
        totalSpots: 16,
        availableSpots: 5,
        evSpots: 2,
        accessibleSpots: 2,
      },
    ],
  },
  {
    id: 'br_blr_tech',
    name: 'HDFC Bank Tech Innovation Hub',
    city: 'Bengaluru',
    address: 'Plot 12, Phase 1, Electronic City, Bengaluru - 560100',
    totalFloors: 4,
    zones: [
      {
        id: 'zn_blr_b1',
        name: 'Level -1 (Tech Leadership & EV)',
        code: 'L1',
        totalSpots: 30,
        availableSpots: 14,
        evSpots: 10,
        accessibleSpots: 4,
      },
      {
        id: 'zn_blr_b2',
        name: 'Level -2 (Developer Parking)',
        code: 'L2',
        totalSpots: 45,
        availableSpots: 22,
        evSpots: 6,
        accessibleSpots: 4,
      },
    ],
  },
];

// Helper to generate a realistic array of parking spots for a floor
export const generateFloorSpots = (zoneId: string, zoneCode: string): ParkingSpot[] => {
  const spots: ParkingSpot[] = [];
  const rows = ['A', 'B', 'C', 'D'];
  
  rows.forEach((row, rowIndex) => {
    for (let col = 1; col <= 6; col++) {
      const code = `${zoneCode}-${row}${col}`;
      const isEv = (rowIndex === 0 && col <= 3) || (rowIndex === 1 && col === 1);
      const isAccessible = rowIndex === 3 && col <= 2;
      const isExecutive = rowIndex === 0 || rowIndex === 1;

      // Status generation algorithm
      let status: 'available' | 'occupied' | 'reserved' = 'available';
      if ((rowIndex * 6 + col) % 3 === 0) {
        status = 'occupied';
      } else if (isExecutive && col % 5 === 0) {
        status = 'reserved';
      }

      let type: 'Standard' | 'Executive' | 'EV Charging' | 'Accessible' | 'Two-Wheeler' = 'Standard';
      if (isEv) type = 'EV Charging';
      else if (isAccessible) type = 'Accessible';
      else if (isExecutive) type = 'Executive';

      spots.push({
        id: `spot_${zoneId}_${code}`,
        code,
        floorId: zoneId,
        type,
        status,
        nearElevator: col <= 2,
        hasEvCharger: isEv,
        occupantVehicle: status === 'occupied' ? `MH02AB${1000 + col * 123}` : undefined,
      });
    }
  });

  return spots;
};

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk_109283',
    userId: 'usr_default',
    userName: 'Mugunth G',
    userEmail: 'mugunth.g23@gmail.com',
    spotId: 'spot_zn_b1_B1-A04',
    spotCode: 'B1-A04',
    zoneName: 'Basement 1 (Executive & VIP)',
    floorName: 'Basement Level 1',
    branchName: 'HDFC Bank House - Corporate HQ',
    vehicleNumber: 'MH02CP4821',
    vehicleType: 'Sedan',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    endTime: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString(), // 5.5 hours from now
    status: 'active',
    qrCode: 'HDFC-PARK-PASS-89241-B1A04',
    pillarLocation: 'Pillar B1-Red (#04) near Elevator Bank 2',
  },
];
