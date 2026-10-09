"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "serial-pro-install-prompt-dismissed";

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (isInstalled) return;

    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY) === "true") return;
    } catch (storageError) {
      console.warn("Could not read PWA install prompt state:", storageError);
    }

    const userAgent = window.navigator.userAgent;
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setInstallPrompt(null);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    const platformCheck = window.setTimeout(() => {
      if (isAppleMobile) {
        setIos(true);
        setVisible(true);
      }
    }, 0);
    return () => {
      window.clearTimeout(platformCheck);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch (storageError) {
      console.warn("Could not save PWA install prompt state:", storageError);
    }
  }

  async function install() {
    if (!installPrompt) return;
    setError("");
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setVisible(false);
    } catch (promptError) {
      console.error("Could not open the PWA install prompt:", promptError);
      setError("Install prompt could not be opened. Please try again later.");
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Install Serial Pro"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-brand-100 bg-white p-4 shadow-xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-base font-bold text-white">
          S
        </span>
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-[14px] font-semibold text-slate-900">
            Install Serial Pro
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
            {ios
              ? "Tap Share, then choose “Add to Home Screen” for quick access."
              : "Add the app to your home screen for quick access."}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[12px] text-red-600">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      </div>
      {!ios && installPrompt && (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-3 min-h-11 w-full rounded-xl bg-brand-700 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Install app
        </button>
      )}
    </aside>
  );
}
