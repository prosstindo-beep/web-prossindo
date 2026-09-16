export interface Freelancer {
  id: number | string;
  name: string;
  location: string;
  status: 'Available' | 'Busy' | string;
  service: string;
  description: string;
  images: string[] | string;
  created_at?: string;
}

export interface Member {
  id?: number | string;
  username: string;
  name?: string;
  created_at?: string;
}

export interface AdminAccount {
  id: number | string;
  email: string;
  username?: string;
  name?: string;
  role?: string;
  autoConfirmed?: boolean;
  createdAt?: string;
}

export interface AdminSession {
  access_token: string;
  token?: string;
  user: {
    id?: string;
    email: string;
    name?: string;
    username?: string;
    role?: string;
  };
}

export interface CurrentUser {
  role: 'member' | 'admin';
  email?: string;
  username: string;
  name: string;
}

export interface WaLead {
  id?: number | string;
  member_name: string;
  talent_name: string;
  service: string;
  reference: string;
  status?: string;
  created_at?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
