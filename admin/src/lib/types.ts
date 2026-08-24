export type Page = 'dashboard' | 'users' | 'bookings' | 'providers' | 'categories' | 'supportTickets';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  userType: 'customer' | 'provider';
  createdAt: string;
  onboardingComplete?: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'pending_completion' | 'reschedule_pending';

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  subServiceId?: string;
  serviceName: string;
  price: number;
  type: 'fixed' | 'hourly' | 'cleaning-company';
  hours?: number | null;
  addressText?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: BookingStatus;
  createdAt: string;
  completedByAdmin?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  type?: string;
  payload?: Record<string, unknown>;
  sentAt: unknown;
}

export interface Review {
  id: string;
  bookingId: string;
  providerId: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewText?: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  hasHourlyOption?: boolean;
  subServices?: { id: string; name: string }[];
}

// Mirrors src/lib/supportTickets.ts on the mobile app — same Firestore collection
// (supportTickets/{id} + supportTickets/{id}/messages), field names must match.
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketSenderType = 'customer' | 'provider' | 'admin';

export interface SupportTicket {
  id: string;
  userId: string;
  userType: 'customer' | 'provider';
  userName: string;
  subject: string;
  status: TicketStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderType: TicketSenderType;
  text: string;
  createdAt: unknown;
}
