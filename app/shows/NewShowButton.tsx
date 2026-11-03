"use client";

import { useActionState, useRef } from "react";
import { createShow, type CreateShowState } from "./actions";
import styles from "./shows.module.css";

export default function NewShowButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<CreateShowState, FormData>(createShow, {});

  return (
    <>
      <button type="button" className={styles.primary} onClick={() => dialogRef.current?.showModal()}>
        + New show
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <form action={action} className={styles.form}>
          <h2>New show</h2>
          <label className={styles.field}>
            Name
            <input name="name" required maxLength={200} autoFocus placeholder="e.g. Amsterdam – 14 November" />
          </label>
          {state.error && <p className={styles.error}>{state.error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? "Creating…" : "Create show"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
