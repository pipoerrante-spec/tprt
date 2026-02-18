import { ConfirmationClient } from "@/components/confirm/confirmation-client";

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ConfirmationClient bookingId={params.id} />
    </main>
  );
}

