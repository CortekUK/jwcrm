"use client";

import { useRef } from "react";
import { WillMultiStepForm, SaveControls } from "@/components/WillMultiStepForm";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/portal/PageHeader";
import { useWillForm } from "@/hooks/useWillForm";

export default function ClientWill() {
  const { t } = useTranslation(['portal', 'form']);
  const willFormHook = useWillForm();
  const manualSaveRef = useRef<(() => void) | null>(null);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('portal:createYourWill')}
        subtitle={t('portal:guidedProcessSubtitle')}
      >
        <SaveControls
          saveStatus={willFormHook.saveStatus}
          lastSavedAt={willFormHook.lastSavedAt}
          saveError={willFormHook.saveError}
          onRetry={willFormHook.retrySave}
          onManualSave={() => manualSaveRef.current?.()}
          isSaving={willFormHook.saving || willFormHook.saveStatus === 'saving'}
        />
      </PageHeader>
      <WillMultiStepForm
        willFormHook={willFormHook}
        onManualSaveReady={(fn) => manualSaveRef.current = fn}
      />
    </div>
  );
}
