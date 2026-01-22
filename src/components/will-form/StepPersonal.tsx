import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, X, MessageCircle, Mail, Phone } from "lucide-react";
import { StepTitle } from "./StepTitle";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Answers } from "@/types/will-form";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { formatPhoneNumber } from "@/utils/phoneValidation";

interface StepPersonalProps {
  data: Answers['personal'];
  onChange: (data: Answers['personal']) => void;
  errors?: Record<string, string>;
}

export function StepPersonal({ data, onChange, errors = {} }: StepPersonalProps) {
  const { t, i18n } = useTranslation('form');
  const isRtl = i18n.language === 'ar';
  const [countryInput, setCountryInput] = useState('');
  
  // Ensure data has required array properties with defaults
  const safeData = {
    ...data,
    assets_country: data?.assets_country || [],
    preferred_contact_methods: data?.preferred_contact_methods || []
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...safeData, date: date.toISOString() });
    }
  };

  const selectedDate = safeData.date ? new Date(safeData.date) : undefined;

  const handleAddCountry = (country: string) => {
    const trimmed = country.trim();
    if (trimmed && !safeData.assets_country.includes(trimmed)) {
      onChange({
        ...safeData,
        assets_country: [...safeData.assets_country, trimmed]
      });
    }
  };

  const handleRemoveCountry = (index: number) => {
    onChange({
      ...safeData,
      assets_country: safeData.assets_country.filter((_, i) => i !== index)
    });
  };

  const handleContactMethodToggle = (method: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...safeData,
        preferred_contact_methods: [...safeData.preferred_contact_methods, method]
      });
    } else {
      onChange({
        ...safeData,
        preferred_contact_methods: safeData.preferred_contact_methods.filter(m => m !== method)
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Heading */}
      <StepTitle title={t('personalDetails')} />
      <p className="text-[0.95rem] text-[#5C5C5C] mb-6 -mt-4">
        {t('personalDetailsIntro')}
      </p>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Full Name */}
        <div>
          <Label htmlFor="full_name">{t('fullName')} *</Label>
          <Input
            id="full_name"
            value={safeData.full_name || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
              onChange({ ...safeData, full_name: value });
            }}
            placeholder={t('fullNamePlaceholder')}
            className={cn(errors.full_name && "border-destructive")}
          />
          {errors.full_name && <p className="text-destructive text-sm mt-1">{errors.full_name}</p>}
        </div>

        {/* Contact Number */}
        <div>
          <Label htmlFor="contact_number">{t('contactNumberLabel')} *</Label>
          <Input
            id="contact_number"
            type="tel"
            value={safeData.contact_number || ''}
            onChange={(e) => onChange({ ...safeData, contact_number: formatPhoneNumber(e.target.value) })}
            placeholder="+971501234567"
            className={cn(errors.contact_number && "border-destructive")}
          />
          {errors.contact_number && <p className="text-destructive text-sm mt-1">{errors.contact_number}</p>}
        </div>

        {/* Address */}
        <div>
          <Label htmlFor="address">{t('address')} *</Label>
          <Textarea
            id="address"
            value={safeData.address || ''}
            onChange={(e) => onChange({ ...safeData, address: e.target.value })}
            placeholder={t('addressPlaceholder')}
            className={cn(errors.address && "border-destructive")}
            rows={3}
          />
          {errors.address && <p className="text-destructive text-sm mt-1">{errors.address}</p>}
        </div>

        {/* Email Address */}
        <div>
          <Label htmlFor="email">{t('emailAddressLabel')} *</Label>
          <Input
            id="email"
            type="email"
            value={safeData.email || ''}
            onChange={(e) => onChange({ ...safeData, email: e.target.value })}
            placeholder={t('emailPlaceholder')}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
        </div>

        {/* Date */}
        <div>
          <Label>{t('dateLabel')} *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !safeData.date && "text-muted-foreground",
                  errors.date && "border-destructive"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : t('pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-destructive text-sm mt-1">{errors.date}</p>}
        </div>

        {/* Country your assets are located */}
        <div>
          <Label htmlFor="assets_country">{t('assetsCountryLabel')}</Label>
          <p className="text-sm text-muted-foreground mt-1 mb-2">
            {t('assetsCountryDescription')}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {t('assetsCountryHelper')}
          </p>
          <Input
            id="assets_country"
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            placeholder={t('assetsCountryPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCountry(countryInput);
                setCountryInput('');
              }
            }}
            className={cn(errors.assets_country && "border-destructive")}
          />
          {safeData.assets_country.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {safeData.assets_country.map((country, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => handleRemoveCountry(idx)}
                >
                  {country}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
          {errors.assets_country && <p className="text-destructive text-sm mt-1">{errors.assets_country}</p>}
        </div>

        {/* Preferred contact method(s) */}
        <div className="space-y-3">
          <Label>{t('preferredContactMethodsLabel')} *</Label>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="whatsapp"
                checked={safeData.preferred_contact_methods.includes('WhatsApp')}
                onCheckedChange={(checked) => handleContactMethodToggle('WhatsApp', checked === true)}
              />
              <Label htmlFor="whatsapp" className="font-normal cursor-pointer flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366]" strokeWidth={2} />
                {t('whatsappLabel')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email_method"
                checked={safeData.preferred_contact_methods.includes('Email')}
                onCheckedChange={(checked) => handleContactMethodToggle('Email', checked === true)}
              />
              <Label htmlFor="email_method" className="font-normal cursor-pointer flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0C5536]" strokeWidth={2} />
                {t('emailLabel')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="call"
                checked={safeData.preferred_contact_methods.includes('Call')}
                onCheckedChange={(checked) => handleContactMethodToggle('Call', checked === true)}
              />
              <Label htmlFor="call" className="font-normal cursor-pointer flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#C6A03B]" strokeWidth={2} />
                {t('callLabel')}
              </Label>
            </div>
          </div>
          {errors.preferred_contact_methods && (
            <p className="text-destructive text-sm mt-1">{errors.preferred_contact_methods}</p>
          )}
        </div>

        {/* Marital Status */}
        <div>
          <Label>{t('maritalStatus')} *</Label>
          <Select
            value={safeData.marital_status || ''}
            onValueChange={(value: any) => onChange({ ...safeData, marital_status: value })}
          >
            <SelectTrigger className={cn(errors.marital_status && "border-destructive", isRtl && "text-right")}>
              <SelectValue placeholder={t('maritalStatusPlaceholder')} />
            </SelectTrigger>
            <SelectContent className={cn(isRtl && "text-right")}>
              <SelectItem value="single">{t('single')}</SelectItem>
              <SelectItem value="married">{t('married')}</SelectItem>
              <SelectItem value="divorced">{t('divorced')}</SelectItem>
              <SelectItem value="widowed">{t('widowed')}</SelectItem>
            </SelectContent>
          </Select>
          {errors.marital_status && <p className="text-destructive text-sm mt-1">{errors.marital_status}</p>}
        </div>

        {/* Religion */}
        <div>
          <Label htmlFor="religion">{t('religionLabel')} *</Label>
          <Input
            id="religion"
            value={safeData.religion || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
              onChange({ ...safeData, religion: value });
            }}
            placeholder={t('religionPlaceholder')}
            className={cn(errors.religion && "border-destructive")}
          />
          {errors.religion && <p className="text-destructive text-sm mt-1">{errors.religion}</p>}
        </div>
      </div>
    </div>
  );
}
