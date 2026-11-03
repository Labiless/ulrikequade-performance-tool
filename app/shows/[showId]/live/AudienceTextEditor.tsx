"use client";

import { useState, useTransition } from "react";
import { AUDIENCE_TEXT_MAX, DEFAULT_AUDIENCE_TEXT } from "@/lib/audience-text";
import { updateAudienceText } from "../../actions";
import styles from "./live.module.css";

type Props = { showId: string; initialText: string | null };

/** Lets the control room change the instruction shown on the audience phones. */
export default function AudienceTextEditor({ showId, initialText }: Props) {
  const [saved, setSaved] = useState(initialText ?? "");
  const [draft, setDraft] = useState(initialText ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const dirty = draft.trim() !== saved.trim();

  const save = () => {
    startTransition(async () => {
      try {
        const value = await updateAudienceText(showId, draft);
        setSaved(value ?? "");
        setDraft(value ?? "");
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <form
      className={styles.textEditor}
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save();
      }}
    >
      <label className={styles.label} htmlFor="audience-text">
        Text on the audience phones
      </label>
      <textarea
        id="audience-text"
        className={styles.textInput}
        value={draft}
        placeholder={DEFAULT_AUDIENCE_TEXT}
        maxLength={AUDIENCE_TEXT_MAX}
        rows={3}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus("idle");
        }}
      />
      <div className={styles.textActions}>
        <span className={styles.sync}>
          {status === "saved" && "Saved ✓ – phones update within a few seconds"}
          {status === "error" && "Couldn't save. Try again."}
          {status === "idle" && (draft.trim() ? `${draft.length}/${AUDIENCE_TEXT_MAX}` : "Empty = default text")}
        </span>
        <button type="submit" className={styles.ghost} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
