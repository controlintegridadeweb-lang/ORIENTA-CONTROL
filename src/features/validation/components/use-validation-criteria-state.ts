"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UnifiedFormCriterion } from "../contracts";
import { focusFirstPendingCriterion } from "./validation-focus";

export function useValidationCriteriaState(
  initialCriteria: UnifiedFormCriterion[],
) {
  const router = useRouter();
  const focusAfterRefresh = useRef(false);
  const [itemPending, setItemPending] = useState(false);

  useEffect(() => {
    if (!focusAfterRefresh.current) return;
    focusAfterRefresh.current = false;
    window.requestAnimationFrame(() => {
      focusFirstPendingCriterion(initialCriteria);
    });
  }, [initialCriteria]);

  function refreshAndFocus() {
    focusAfterRefresh.current = true;
    router.refresh();
  }

  async function withItemPending(
    locked: boolean,
    action: () => Promise<void>,
  ) {
    if (locked) return;
    setItemPending(true);
    try {
      await action();
      refreshAndFocus();
    } finally {
      setItemPending(false);
    }
  }

  return {
    criteria: initialCriteria,
    itemPending,
    refreshAndFocus,
    withItemPending,
  };
}
