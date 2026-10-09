"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  access_denied: "You declined the Telegram authorization. Try again when you're ready.",
  state_mismatch: "The sign-in request expired or was tampered with. Please try again.",
  missing_code: "Telegram didn't return an authorization code. Please try again.",
  token_exchange_failed:
    "Couldn't complete the Telegram handshake. Please try again.",
  missing_id_token: "Telegram didn't return your profile. Please try again.",
  invalid_token: "Telegram's response couldn't be verified. Please try again.",
};

function ErrorNoteInner() {
  const error = useSearchParams().get("error");
  if (!error || !ERROR_COPY[error]) return null;
  return (
    <p className="status" role="alert">
      {ERROR_COPY[error]}
    </p>
  );
}

/** Shows redirect-flow errors (?error=…) without forcing the page dynamic at build. */
export default function LoginErrorNote() {
  return (
    <Suspense>
      <ErrorNoteInner />
    </Suspense>
  );
}
