"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type CampaignLeadFilterLoadingContextValue = {
  isLeadFilterLoading: boolean;
  startLeadFilterLoading: (targetFilterKey: string) => void;
};

const CampaignLeadFilterLoadingContext = createContext<CampaignLeadFilterLoadingContextValue>({
  isLeadFilterLoading: false,
  startLeadFilterLoading: () => {},
});

export function CampaignLeadFilterLoadingProvider({
  children,
  filterKey,
}: {
  children: React.ReactNode;
  filterKey: string;
}) {
  const [pendingFilterKey, setPendingFilterKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeadFilterLoading = pendingFilterKey !== null && pendingFilterKey !== filterKey;

  const clearLoadingTimeout = useCallback(() => {
    if (!timeoutRef.current) {
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const startLeadFilterLoading = useCallback((targetFilterKey: string) => {
    clearLoadingTimeout();
    setPendingFilterKey(targetFilterKey);
    timeoutRef.current = setTimeout(() => {
      setPendingFilterKey(null);
      timeoutRef.current = null;
    }, 12000);
  }, [clearLoadingTimeout]);

  useEffect(() => {
    if (pendingFilterKey !== filterKey) {
      return;
    }

    clearLoadingTimeout();
    const timeoutId = setTimeout(() => {
      setPendingFilterKey(null);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [clearLoadingTimeout, filterKey, pendingFilterKey]);

  useEffect(() => clearLoadingTimeout, [clearLoadingTimeout]);

  const value = useMemo(
    () => ({
      isLeadFilterLoading,
      startLeadFilterLoading,
    }),
    [isLeadFilterLoading, startLeadFilterLoading],
  );

  return (
    <CampaignLeadFilterLoadingContext.Provider value={value}>
      {children}
    </CampaignLeadFilterLoadingContext.Provider>
  );
}

export function useCampaignLeadFilterLoading() {
  return useContext(CampaignLeadFilterLoadingContext);
}
