// Starting-point policy text. Have it reviewed by a lawyer and fill in the business details before launch.
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL || 'support@saath.in';

export default function Policies() {
  return (
    <div className="container narrow section-pad prose">
      <h1>Terms, privacy and refunds</h1>
      <p className="muted">Last updated: October 2026. Questions: <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></p>

      <h2 id="terms">Terms of use</h2>
      <p>Saath helps residents of a housing society book home and car services together. Saath connects residents with independent service partners. The partner performs the service at the agreed date and time slot.</p>
      <p>A group unlocks its group price only when the required number of flats has joined. If the target is not reached by the service date, the group does not go ahead and nothing is charged. Time slots are arrival windows, and the team may arrive anywhere inside the window. Residents must keep the flat or vehicle accessible during the slot.</p>

      <h2 id="privacy">Privacy</h2>
      <p>We store your name, email, mobile number, society and flat number to run your bookings. Neighbours in a group see only your first name and block. Your mobile number is shared only with the service partner who visits you. We do not sell your data. Online payments are handled by Razorpay, and we never see or store your card or UPI details.</p>

      <h2 id="refunds">Payments, cancellation and refunds</h2>
      <p>Joining a group is free. After the group price unlocks you can pay online (UPI, card, netbanking) or pay the service partner by UPI or cash after the service.</p>
      <p>If you paid online and the group is cancelled, the full amount is refunded to the original payment method within 5 to 7 working days. If you paid online and want to cancel before the service date, write to us and we will refund you, unless the service has already been done. If you are not happy with a completed service, report it within 48 hours and the partner will redo it or we will refund you.</p>
    </div>
  );
}
