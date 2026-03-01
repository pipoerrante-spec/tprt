import { ConfirmationClient } from "@/components/confirm/confirmation-client";
import { getBookingConfirmation } from "@/lib/bookings/get-booking-confirmation";

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getBookingConfirmation(id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ConfirmationClient bookingId={id} initialData={result.data} />
    </main>
  );
}
