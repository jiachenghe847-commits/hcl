/** Booking draft and server-backed booking list. */
import type { Booking, Mode } from '@haven/contracts';
import { api } from '../../api/client';
import { useDraft } from '../../app/draft';
import { useAsync } from '../../app/useAsync';

export interface BookingDraft {
  counsellorId?: string | undefined;
  mode?: Mode | undefined;
  day?: string | undefined;
  slotId?: string | undefined;
  startsAt?: string | undefined;
  note: string;
  /** Rescheduling: the booking to cancel once the new one succeeds. */
  replaceBookingId?: string | undefined;
  /** One key per draft, so retrying or double-tapping "Confirm" never books twice. */
  idempotencyKey?: string | undefined;
}

export const useBookingDraft = () => useDraft<BookingDraft>('booking', { note: '' });

/** Confirmed bookings, soonest first. */
export const upcoming = (bookings: Booking[]) =>
  bookings.filter((b) => b.status === 'confirmed').sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));

export function useMyBookings() {
  return useAsync(() => api.bookings().then(upcoming), []);
}
