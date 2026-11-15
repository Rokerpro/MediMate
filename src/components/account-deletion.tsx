"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClientError, deleteAccount } from "@/lib/api-client";

export function AccountDeletion() {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirming) confirmationInputRef.current?.focus();
  }, [confirming]);

  async function submitDeletion() {
    if (confirmation !== "DELETE" || deleting) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAccount();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "We could not delete your account. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function cancelConfirmation() {
    setConfirming(false);
    setConfirmation("");
    setErrorMessage(null);
    requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="space-y-4 rounded-xl border border-red-200 bg-red-50/70 p-5 sm:p-8"
    >
      <div>
        <h2 id="danger-zone-heading" className="text-xl font-semibold text-red-950">Danger zone</h2>
        <p className="mt-2 text-sm leading-6 text-red-900">
          Permanently remove this account and its data.
        </p>
      </div>

      {!confirming ? (
        <button
          ref={deleteButtonRef}
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirming(true);
          }}
          className="rounded-full border border-red-700 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Delete my account
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitDeletion();
          }}
          className="space-y-4"
        >
          <p id="delete-account-warning" className="text-sm leading-6 text-red-950">
            This permanently deletes your profile, health logs, chats and reminders. This cannot be undone.
          </p>
          <div>
            <label htmlFor="delete-account-confirmation" className="block text-sm font-medium text-red-950">
              Type DELETE to confirm
            </label>
            <input
              ref={confirmationInputRef}
              id="delete-account-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-describedby="delete-account-warning"
              autoComplete="off"
              disabled={deleting}
              className="mt-1 w-full max-w-sm rounded-lg border border-red-300 bg-white px-3 py-2 text-[#24352d] outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            />
          </div>

          {errorMessage && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-900">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={() => void submitDeletion()}
                disabled={deleting || confirmation !== "DELETE"}
                className="rounded-lg border border-red-700 px-3 py-1.5 font-semibold hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cancelConfirmation}
              disabled={deleting}
              className="rounded-full border border-[#cbd6c5] bg-white px-4 py-2 text-sm font-semibold text-[#24352d] hover:bg-[#f3f4ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c98b48] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleting || confirmation !== "DELETE"}
              className="rounded-full bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
