export type UserRole = 'admin' | 'captain' | 'player';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at: string;
}

export interface PlayerProfile {
  id: number;
  user_id: number;
  employee_id?: string;
  age?: number;
  mobile?: string;
  jersey_name?: string;
  jersey_number?: number;
  tshirt_size?: string;
  category: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
  batting_style?: string;
  bowling_style?: string;
  experience_level?: string;
  emergency_contact?: string;
  bio?: string;
  availability: boolean;
  fitness_declaration: boolean;
  achievements?: string;
  preferred_batting_order?: string;
  base_price: number;
  image_path?: string;
  is_sold: boolean;
  is_submitted?: boolean;
  is_shopfloor?: boolean;
  created_at: string;
  name?: string;
  department?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  user_department?: string;
  user?: User;
  team_name?: string;
}

export interface TeamPlayer {
  id: number;
  player_id: number;
  purchase_price: number;
  purchased_at: string;
  player: PlayerProfile;
}

export interface Team {
  id: number;
  name: string;
  logo_path?: string;
  captain_id?: number;
  captain_name?: string;
  budget_total: number;
  budget_used: number;
  reserved_budget: number;
  spendable_budget: number;
  players_count: number;
  total_assigned_players?: number;
  created_at: string;
  players?: TeamPlayer[];
}

export interface Bid {
  id: number;
  team_id: number;
  team_name: string;
  team_logo?: string;
  amount: number;
  created_at: string;
}

export interface QueueItem {
  id: number;
  player_id: number;
  order_index: number;
  status: 'queued' | 'current' | 'sold' | 'unsold';
  player_name: string;
  category: string;
  base_price: number;
  image_path?: string;
  is_sold?: boolean;
}

export interface CurrentPlayer {
  id: number;
  name: string;
  employee_id?: string;
  department?: string;
  category: string;
  batting_style?: string;
  bowling_style?: string;
  experience_level?: string;
  base_price: number;
  image_path?: string;
  bio?: string;
  achievements?: string;
}

export interface AuctionState {
  session_id: number;
  status: 'not_started' | 'live' | 'paused' | 'held' | 'completed' | 'intermission';
  timer_seconds: number;
  intermission_seconds?: number;
  last_sold_info?: {
    player_name: string;
    team_name: string;
    amount: number;
    image_path?: string;
    is_unsold?: boolean;
  };
  current_player?: CurrentPlayer;
  highest_bid?: number;
  highest_bidder_team?: {
    id: number;
    name: string;
    logo_path?: string;
  };
  bids: Bid[];
  queue: QueueItem[];
  teams: Team[];
}

export interface ApplicationSettings {
  team_budget: number;
  base_price: number;
  timer_seconds: number;
  intermission_seconds?: number;
  min_players: number;
  max_players: number;
  min_squad_size?: number;
  timer_reset_on_bid: boolean;
  registration_closed_date?: string;
  registration_closed?: boolean;
  bidding_cooldown_seconds?: number;
}

export interface NotificationItem {
  id: number;
  type: 'info' | 'success' | 'warning' | 'alert';
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AnalyticsDashboard {
  kpis: {
    total_users: number;
    total_players: number;
    total_captains: number;
    total_teams: number;
    sold_players: number;
    unsold_players: number;
    remaining_players: number;
    completion_percentage: number;
    highest_price: number;
    lowest_price: number;
    avg_price: number;
    most_expensive_team: string;
    cheapest_team: string;
  };
  highest_sold_player?: {
    name: string;
    team: string;
    price: number;
    category: string;
    image_path?: string;
  };
  category_distribution: Record<string, number>;
  department_distribution: Record<string, number>;
  team_spend_breakdown: Array<{
    team_id: number;
    team_name: string;
    captain_name?: string;
    logo_path?: string;
    budget_total: number;
    budget_used: number;
    spendable_budget: number;
    players_count?: number;
    player_count?: number;
  }>;
}

export const DEPARTMENTS = [
  "Accounts",
  "Aftermarket Sales",
  "Application",
  "Automation & Control",
  "Business Analytics",
  "Commissioning",
  "Design",
  "EHS",
  "Electrical",
  "Engineering",
  "EXIM & Commercial",
  "Facility Maintenance",
  "HR & IR",
  "Instrumentation",
  "IT",
  "Legal & Compliance",
  "Maintenance",
  "Management",
  "Manufacturing",
  "Manufacturing Planning",
  "Process",
  "Project Management",
  "Project Planning",
  "Purchase",
  "Quality",
  "Sales",
  "Sales & Service",
  "Service",
  "Store",
  "Supply Chain Management",
  "Technical Project Management"
];
