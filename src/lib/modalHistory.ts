// Helper único para que el botón físico de retroceso cierre modales/drawers
// en lugar de salir de la web. Uso: pushModal(id) al abrir, el hook cierra al volver atrás.

import { useEffect } from "react";

export function pushModal(id: string) {
  try {
    window.history.pushState({ modalId: id }, "");
  } catch {
    /* noop */
  }
}

export function popModal(id: string) {
  try {
    const st = window.history.state as { modalId?: string } | null;
    if (st && st.modalId === id) window.history.back();
  } catch {
    /* noop */
  }
}

/** Registra un popstate que ejecuta onBack solo si el modal sigue abierto. */
export function useBackButton(modalId: string, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    pushModal(modalId);
    const handler = () => onClose();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isOpen, modalId, onClose]);
}

/** Cierre seguro: si este modal puso el estado, vuelve atrás; si no, cierra directo. */
export function safeClose(modalId: string, onClose: () => void) {
  try {
    const st = window.history.state as { modalId?: string } | null;
    if (st && st.modalId === modalId) {
      window.history.back();
      return;
    }
  } catch {
    /* noop */
  }
  onClose();
}
