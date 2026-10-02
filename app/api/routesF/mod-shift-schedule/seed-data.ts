export interface ModShift {
  shift_id: string;
  creator_id: string;
  mod_id: string;
  day: DayOfWeek;
  start_time: string;
  end_time: string;
}

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const seedShifts: ModShift[] = [
  {
    shift_id: 'shift_seed_001',
    creator_id: 'creator_001',
    mod_id: 'mod_alice',
    day: 'monday',
    start_time: '09:00',
    end_time: '17:00',
  },
  {
    shift_id: 'shift_seed_002',
    creator_id: 'creator_001',
    mod_id: 'mod_bob',
    day: 'monday',
    start_time: '22:00',
    end_time: '06:00',
  },
  {
    shift_id: 'shift_seed_003',
    creator_id: 'creator_001',
    mod_id: 'mod_carol',
    day: 'tuesday',
    start_time: '06:00',
    end_time: '14:00',
  },
];
