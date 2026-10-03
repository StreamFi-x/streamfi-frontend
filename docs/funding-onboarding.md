# First-time wallet funding (#1424)

A user who signs in with Google gets a custodial Stellar wallet: StreamFi
generates the keypair and stores the encrypted secret (`/api/auth/onboarding`,
`users.encrypted_stellar_key`). The wallet starts empty. The funding
onboarding explains what the wallet is and why it is empty, then hands off to
the existing Transak integration (`hooks/useTransak.ts`), and reports the
result honestly.

Code: `app/api/wallet/funding-status/route.ts`,
`lib/onboarding/funding-machine.ts`,
`components/wallet/funding/{FundingOnboardingProvider,FundingWizard,FundWalletEntry}.tsx`.

## Who sees it

`GET /api/wallet/funding-status` decides, on the server:

| User                                                                          | walletType  | eligible |
| ----------------------------------------------------------------------------- | ----------- | -------- |
| Custodial wallet the ledger does not know yet (never funded)                  | `custodial` | **yes**  |
| Custodial wallet that exists on the ledger (funded, even if since spent down) | `custodial` | no       |
| Wallet connected through a browser extension                                  | `external`  | no       |
| No Stellar wallet                                                             | `none`      | no       |

"Never funded" comes from the ledger itself: a new keypair does not exist on
Stellar until it first receives at least the base reserve (Horizon answers
404). That separates first-time users from existing users topping up, and
cannot be fooled by client state. The status is only requested for Google
sign-ins; wallet-extension users never trigger a Horizon lookup. If Horizon is
unavailable the endpoint returns 503 and nothing is shown.

## States

```
eligible ─OPEN─▶ intro (wallet → XLM → how to fund) ─START_FUNDING─▶ funding
intro / abandoned / failed ─DEFER─▶ deferred ─OPEN─▶ intro
funding ─ORDER_CREATED / ORDER_SUCCESSFUL─▶ pending
funding ─WIDGET_CLOSED (no order) / ORDER_CANCELLED─▶ abandoned ─START_FUNDING─▶ funding
funding / pending ─ORDER_FAILED─▶ failed ─START_FUNDING─▶ funding
pending ─(30 min)─▶ pending + stalled ─START_FUNDING─▶ funding
any unfinished state ─status shows the account funded─▶ success
```

Every transition is in one reducer (`fundingReducer`); events that do not
apply in the current state change nothing.

## What Transak's events mean here

| Transak event                                                 | Shown to the user                                                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSAK_ORDER_CREATED` / `TRANSAK_ORDER_SUCCESSFUL`          | **Pending**: "Your purchase is on its way… You do not need to buy again." Transak finishing its side does not mean the XLM has reached the wallet. |
| Widget closed with no order                                   | **Abandoned**: no purchase was made; continue or later. Not shown as a failure.                                                                    |
| `TRANSAK_ORDER_CANCELLED`                                     | Abandoned.                                                                                                                                         |
| `TRANSAK_ORDER_FAILED`                                        | **Failed**: the order did not complete. Transak's emails have the details, which StreamFi does not receive.                                        |
| Widget cannot open (e.g. `NEXT_PUBLIC_TRANSAK_API_KEY` unset) | "Adding funds is not available right now."                                                                                                         |

- **Success** is shown only when the funding status reports the account
  exists on the ledger. While pending, the status is re-checked every 15
  seconds.
- **Pending** is saved per wallet in `localStorage`, so a reload still shows
  it and does not invite a second purchase. Starting another purchase is
  refused while a purchase is pending. After 30 minutes the dialog says it is
  taking longer than usual, points to Transak's email, and only then offers
  "Try again".
- **Regional and ID (KYC) restrictions** are Transak's. The copy says so
  plainly ("decided by Transak and can depend on your country; StreamFi
  cannot change them"). The intro's last step, and the abandoned and failed
  screens, show the wallet address with a copy button, so the user can fund
  it from an exchange or another wallet instead.
- Transak order payloads are passed to callbacks, never logged.

## Re-entry

- The wizard opens by itself once per visit for an eligible user who has not
  deferred it, never on `/onboarding`, `/settings` or `/admin`.
- "Maybe later" (or closing the intro) hides the automatic prompt for 7 days
  (`localStorage`, per wallet).
- A **"Fund your wallet"** button in the navbar (next to notifications) stays
  while funding is still to do, including after "Maybe later", and reopens
  the wizard. It reads "Funding pending" while a purchase is pending, and
  disappears once the wallet is funded.

## Changes to `useTransak`

- It now reports `onOrderCreated`, `onOrderFailed`, `onOrderCancelled` and
  `onError`. `onSuccess` and `onClose` keep their behaviour; `AddFundsButton`
  still works unchanged.
- Transak's listeners are static and cannot be removed, and each hook
  instance used to add its own, so every event fired every instance's
  handlers with the callbacks from its first render. Listeners are now
  registered once per page, forward to the instance that opened the widget,
  and always use its latest callbacks.
- `closeTransak` uses the SDK's `close()`. Configuration errors are reported
  through `onError` instead of only being logged.

## Known limitation

Funding makes the wallet active, but custodial users still cannot send tips:
`TipModal` signs with the browser wallet kit, which custodial users do not
have, and `/api/tips/send` never signs the transaction (see
`docs/custodial-key-kms.md`: "no server-side signing path exists today"). The
success message therefore says only that the wallet is funded, not that the
user can now tip. A server-side signing path is separate work.
