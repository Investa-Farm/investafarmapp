/**
 * PaymentModal — thin wrapper around PaymentSheet for investment/loan flows.
 * Previously contained a fake timeout-based simulation; now delegates to the
 * real PaymentSheet for KES mobile-money and card funding.
 */
import { PaymentSheet } from "./payment-sheet";

type PayMethod = "mpesa" | "card";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (method: PayMethod) => void;
  amount: number;
  description: string;
  ctaLabel?: string;
}

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  return (
    <PaymentSheet
      open={open}
      onClose={onClose}
      onSuccess={() => onSuccess("mpesa")}
    />
  );
}
