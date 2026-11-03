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
        + Nuovo show
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <form action={action} className={styles.form}>
          <h2>Nuovo show</h2>
          <label className={styles.field}>
            Nome
            <input name="name" required maxLength={200} autoFocus placeholder="es. Amsterdam – 14 novembre" />
          </label>
          {state.error && <p className={styles.error}>{state.error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
              Annulla
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? "Creo…" : "Crea show"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
