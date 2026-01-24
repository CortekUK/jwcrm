import { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './button';
import { Label } from './label';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
  value?: string; // Base64 signature data
  onChange?: (signature: string, date: string) => void;
  label?: string;
  disabled?: boolean;
}

export function SignaturePad({ value, onChange, label = "Signature", disabled = false }: SignaturePadProps) {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const { t } = useTranslation(['form']);

  // Load existing signature
  useEffect(() => {
    if (value && sigPadRef.current) {
      try {
        sigPadRef.current.fromDataURL(value);
      } catch (error) {
        console.error('Error loading signature:', error);
      }
    }
  }, [value]);

  const handleClear = () => {
    sigPadRef.current?.clear();
    if (onChange) {
      onChange('', '');
    }
  };

  const handleSave = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const signatureData = sigPadRef.current.toDataURL();
      const timestamp = new Date().toISOString();
      if (onChange) {
        onChange(signatureData, timestamp);
      }
    }
  };

  // Auto-save on end of stroke
  const handleEnd = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const signatureData = sigPadRef.current.toDataURL();
      const timestamp = new Date().toISOString();
      if (onChange) {
        onChange(signatureData, timestamp);
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-[14px] font-semibold text-[#333333]">
        {label}
      </Label>
      <div className={`border-2 rounded-lg overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : 'border-[#E6E6E4]'}`}>
        <SignatureCanvas
          ref={sigPadRef}
          canvasProps={{
            className: 'w-full h-40 bg-white cursor-crosshair',
            style: { touchAction: 'none' }
          }}
          backgroundColor="white"
          penColor="#121212"
          minWidth={1}
          maxWidth={2.5}
          velocityFilterWeight={0.7}
          onEnd={handleEnd}
        />
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {t('form:clearSignature')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
          >
            {t('form:saveSignature')}
          </Button>
        </div>
      )}
      {value && (
        <p className="text-xs text-[#6B6B6B]">
          {t('form:signatureSaved')}
        </p>
      )}
    </div>
  );
}
