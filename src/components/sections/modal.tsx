"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="ps-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ps-dialog-head">
        <h2>{title}</h2>
        <button type="button" onClick={close} aria-label="Fermer">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
