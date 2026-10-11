import { useState } from 'react';
import { api } from '../api.js';
import { useMeta } from '../meta.jsx';
import { useToast } from './Toast.jsx';
import { ErrorBox } from './Common.jsx';
import { CheckIcon } from './Icons.jsx';
import { rupees } from '../format.js';

let rzpLoader;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  rzpLoader ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { rzpLoader = null; reject(new Error('Could not load the payment window. Check your internet and try again.')); };
    document.body.appendChild(s);
  });
  return rzpLoader;
}

// Payment choices for one booking: pay online (once the group price is unlocked) or pay after service.
export default function PayPanel({ group: g, units, onPaid }) {
  const { payments } = useMeta();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pay = g.my_payment;
  const unlocked = g.state === 'unlocked';
  const amount = units * g.group_price;

  if (!pay) return null;
  if (pay.status === 'paid') {
    return (
      <div className="alert alert-success" role="status">
        <CheckIcon size={20} />
        <div><p><b>{pay.demo ? `Demo payment of ${rupees(pay.amount_paid)} recorded` : `Paid ${rupees(pay.amount_paid)} online`}</b></p>{pay.demo && <p>This was a test payment. No real money was charged.</p>}<p>Nothing more to pay. Your payment is recorded separately from the service partner's acceptance.</p></div>
      </div>
    );
  }
  if (pay.status === 'refund_due') {
    return <div className="alert alert-info" role="status"><p>This group was cancelled. Your online payment of {rupees(pay.amount_paid)} will be refunded to the original payment method within 5 to 7 working days.</p></div>;
  }

  if (pay.status === 'refunded') {
    return <div className="alert alert-info" role="status"><p>Your payment of {rupees(pay.amount_paid)} was refunded to the original payment method.</p></div>;
  }

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const o = await api('/payments/order', { method: 'POST', body: { group_id: g.id } });
      if (o.mode === 'demo') {
        // Development only: no real money moves.
        if (!window.confirm(`Demo payment of ${rupees(o.amount)}. No real money is charged. Mark as paid?`)) { setBusy(false); return; }
        await api('/payments/demo-confirm', { method: 'POST', body: { order_id: o.order_id } });
        toast('Demo payment recorded.'); onPaid(); setBusy(false); return;
      }
      await loadRazorpay();
      const rzp = new window.Razorpay({
        key: o.key_id, order_id: o.order_id, amount: o.amount * 100, currency: o.currency,
        name: 'Saath', description: o.description, prefill: o.prefill, theme: { color: '#1565F0' },
        handler: async (r) => {
          try {
            await api('/payments/verify', { method: 'POST', body: r });
            toast('Payment received. Thank you!'); onPaid();
          } catch (e) { setError(e); } finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (r) => { setError(new Error(r.error?.description || 'Payment failed. Try again.')); setBusy(false); });
      rzp.open();
    } catch (e) { setError(e); setBusy(false); }
  };

  return (
    <div className="pay-panel">
      <p className="bk-label">Payment</p>
      {pay.display === 'pending' && <p className="muted small"><b>Payment pending.</b> You started an online payment that has not been completed yet. If money was deducted, it is refunded by your bank. You can try again below.</p>}
      {unlocked && payments.mode !== 'off' ? (
        <>
          <button className="btn btn-primary btn-block" onClick={start} disabled={busy}>{busy ? 'Opening payment…' : `Pay ${rupees(amount)} now (UPI, card, netbanking)`}</button>
          <p className="muted small">Or skip this and pay the service partner by UPI or cash after the service.</p>
          {payments.mode === 'demo' && <p className="muted small">Demo mode: no real money is charged.</p>}
        </>
      ) : (
        <p className="muted small">
          {unlocked
            ? 'Pay the service partner by UPI or cash after the service.'
            : 'You pay after the service by UPI or cash. If the group unlocks, you can also pay online here.'}
        </p>
      )}
      <ErrorBox error={error} />
    </div>
  );
}
