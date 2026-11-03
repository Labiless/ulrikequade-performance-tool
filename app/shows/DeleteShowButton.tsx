"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteShow } from "./actions";
import styles from "./shows.module.css";

type Props = { showId: string; name: string; running: boolean };

export default function DeleteShowButton({ showId, name, running }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const warning = running
      ? `"${name}" is running right now. Deleting it stops the audience buttons and removes all its data.\n\nDelete it anyway?`
      : `Delete "${name}"?\n\nAll its audience data and clicks will be removed. This cannot be undone.`;
    if (!window.confirm(warning)) return;
    startTransition(async () => {
      try {
        await deleteShow(showId);
        router.refresh();
      } catch {
        window.alert("Couldn't delete the show. Please try again.");
      }
    });
  };

  return (
    <button type="button" className={styles.deleteButton} onClick={onClick} disabled={pending}>
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
