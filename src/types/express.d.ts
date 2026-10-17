export interface AuthUser {
  user_id: number;
  email: string;
  role: 'Admin' | 'Organizer' | 'Participant';
  full_name: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
    }
  }
}
