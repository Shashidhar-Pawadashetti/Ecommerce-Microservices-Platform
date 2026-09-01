"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ToastMessage, CartItem } from "@/types";

interface LocationInfo {
  city: string;
  zipCode: string;
  country: string;
}

interface StoreContextType {
  toast: ToastMessage | null;
  showToast: (msg: Omit<ToastMessage, "id">) => void;
  hideToast: () => void;
  location: LocationInfo;
  setLocation: (loc: LocationInfo) => void;
  savedForLater: CartItem[];
  saveForLater: (item: CartItem) => void;
  removeFromSavedForLater: (productId: string) => void;
  searchCategory: string;
  setSearchCategory: (cat: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [searchCategory, setSearchCategory] = useState<string>("");
  const [location, setLocationState] = useState<LocationInfo>({
    city: "Seattle",
    zipCode: "98101",
    country: "US",
  });
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);

  // Load saved data from localStorage on mount
  useEffect(() => {
    try {
      const storedLoc = localStorage.getItem("ecom_delivery_location");
      if (storedLoc) setLocationState(JSON.parse(storedLoc));

      const storedSaved = localStorage.getItem("ecom_saved_for_later");
      if (storedSaved) setSavedForLater(JSON.parse(storedSaved));
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const setLocation = (loc: LocationInfo) => {
    setLocationState(loc);
    try {
      localStorage.setItem("ecom_delivery_location", JSON.stringify(loc));
    } catch (e) {}
  };

  const showToast = (msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString();
    setToast({ ...msg, id });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  };

  const hideToast = () => setToast(null);

  const saveForLater = (item: CartItem) => {
    setSavedForLater((prev) => {
      const exists = prev.some((p) => p.productId === item.productId);
      const updated = exists ? prev : [...prev, item];
      try {
        localStorage.setItem("ecom_saved_for_later", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const removeFromSavedForLater = (productId: string) => {
    setSavedForLater((prev) => {
      const updated = prev.filter((p) => p.productId !== productId);
      try {
        localStorage.setItem("ecom_saved_for_later", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  return (
    <StoreContext.Provider
      value={{
        toast,
        showToast,
        hideToast,
        location,
        setLocation,
        savedForLater,
        saveForLater,
        removeFromSavedForLater,
        searchCategory,
        setSearchCategory,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
