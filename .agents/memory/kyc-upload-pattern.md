---
name: KYC upload pattern
description: All-docs-first popup upload pattern with live selfie for KYC modals
---

# KYC Upload Pattern

Both `kyc-modal.tsx` (farmer) and `investor-kyc-modal.tsx` (investor) share the same pattern:

## All-docs-first
- Show a checklist of all required docs. Each row has an "Upload" button if not yet uploaded.
- No single "Submit All" button — each doc is uploaded individually via the UploadPopup.
- When all required docs are uploaded, the backend automatically detects this and sends the under-review email + notification.

## Popup Upload (UploadPopup)
- Rendered via `createPortal(_, document.body)` so it appears above the bottom sheet.
- Z-index `z-[9999]` to ensure it's always on top.
- Centered with `fixed inset-0 flex items-center justify-center p-4`.
- Closes after successful upload (`onSuccess` callback).

## Live Selfie
- `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })`
- Works on both laptop webcam and mobile front camera.
- Video rendered in `<video autoPlay playsInline muted>`.
- Capture via `<canvas>` + `drawImage(videoRef.current, 0, 0)` → `toDataURL("image/jpeg", 0.85)`.
- Always stop stream tracks (`stream.getTracks().forEach(t => t.stop())`) when closing or after capture.
- Falls back to file upload if camera permission denied.

## Under-review trigger
In `routes/kyc.ts` `POST /kyc/upload`:
- Farmer required: `["national_id", "national_id_back", "selfie", "farm_report", "land_title", "group_certificate"]`
- Investor required: `["national_id", "national_id_back", "selfie", "financial_statement"]`
- After each upload, checks if all required types now have at least one doc → inserts notification + sends email.

**Why:** User requested no AI review on the user side; admin reviews manually in admin panel.
