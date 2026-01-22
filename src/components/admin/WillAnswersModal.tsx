import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Executor, Beneficiary, Asset } from "@/types/will-form";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { textAlign } from "@/lib/rtl-utils";

interface WillAnswersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answers: {
    personal?: any;
    identity?: any;
    executors?: Executor[];
    beneficiaries?: Beneficiary[];
    general_beneficiaries?: any[];
    assets?: Asset[];
    special_requests?: any;
    confirmations?: any;
    pdf_language?: 'english' | 'arabic';
  };
  clientName: string;
}

export function WillAnswersModal({ open, onOpenChange, answers, clientName }: WillAnswersModalProps) {
  const { t } = useTranslation('admin');
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';

  if (!answers) return null;

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string | null | undefined): string => {
    if (!str) return "N/A";
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl !p-0 overflow-hidden">
        <div className="flex flex-col max-h-[80vh] h-[80vh]">
          <DialogHeader className={`shrink-0 px-6 pt-6 pb-2 ${textAlign(isRtl)}`}>
            <DialogTitle>{t('willDetails')} - {clientName}</DialogTitle>
            <DialogDescription>
              {t('viewAllSubmittedInfo')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {/* Personal Information */}
              {answers.personal && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${textAlign(isRtl)}`}>{t('personalInformation')}</h3>
                  <div className={`grid grid-cols-2 gap-4 text-sm ${textAlign(isRtl)}`}>
                    <div>
                      <span className="text-muted-foreground">{t('fullName')}:</span>
                      <p className="font-medium">{capitalizeWords(answers.personal.full_name)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('email')}:</span>
                      <p className="font-medium">{answers.personal.email || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('phone')}:</span>
                      <p className="font-medium">{answers.personal.contact_number || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('religion')}:</span>
                      <p className="font-medium">{capitalizeWords(answers.personal.religion)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('maritalStatus')}:</span>
                      <p className="font-medium">{capitalizeWords(answers.personal.marital_status)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('address')}:</span>
                      <p className="font-medium">{capitalizeWords(answers.personal.address)}</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                </div>
              )}

              {/* PDF Language Preference */}
              {answers.pdf_language && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${textAlign(isRtl)}`}>{t('pdfLanguagePreference')}</h3>
                  <div className={`text-sm ${textAlign(isRtl)}`}>
                    <span className="text-muted-foreground">{t('preferredLanguage')}:</span>
                    <p className="font-medium inline-block ml-2">
                      {answers.pdf_language === 'english' ? t('english') : t('arabic')}
                    </p>
                  </div>
                  <Separator className="my-4" />
                </div>
              )}

              {/* Executors */}
              {answers.executors && answers.executors.length > 0 && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${textAlign(isRtl)}`}>{t('executors')}</h3>
                  {answers.executors.map((executor: any, index: number) => (
                    <div key={index} className="mb-4 p-4 bg-muted/30 rounded-lg">
                      <p className={`font-medium mb-2 ${textAlign(isRtl)}`}>
                        {t('level')} {executor.level} {t('executor')}
                      </p>
                      <div className={`grid grid-cols-2 gap-2 text-sm ${textAlign(isRtl)}`}>
                        <div>
                          <span className="text-muted-foreground">{t('name')}:</span> {capitalizeWords(executor.name)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('relation')}:</span> {capitalizeWords(executor.relation)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('email')}:</span> {executor.email || "N/A"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('phone')}:</span> {executor.contact_number || "N/A"}
                        </div>
                        {executor.passport_number && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t('passport')}:</span> {executor.passport_number}
                          </div>
                        )}
                        {executor.emirates_id_number && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t('emiratesId')}:</span> {executor.emirates_id_number}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                </div>
              )}

              {/* Beneficiaries */}
              {answers.beneficiaries && answers.beneficiaries.length > 0 && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${textAlign(isRtl)}`}>{t('beneficiaries')}</h3>
                  {answers.beneficiaries.map((beneficiary: any, index: number) => (
                    <div key={index} className="mb-4 p-4 bg-muted/30 rounded-lg">
                      <p className={`font-medium mb-2 ${textAlign(isRtl)}`}>
                        {t('level')} {beneficiary.level} {t('beneficiary')}
                      </p>
                      <div className={`grid grid-cols-2 gap-2 text-sm ${textAlign(isRtl)}`}>
                        <div>
                          <span className="text-muted-foreground">{t('name')}:</span> {capitalizeWords(beneficiary.name)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('relationship')}:</span> {capitalizeWords(beneficiary.relationship)}
                        </div>
                        {beneficiary.percentage > 0 && (
                          <div>
                            <span className="text-muted-foreground">{t('distribution')}:</span> {beneficiary.percentage}%
                          </div>
                        )}
                        {beneficiary.passport_number && (
                          <div>
                            <span className="text-muted-foreground">{t('passport')}:</span> {beneficiary.passport_number}
                          </div>
                        )}
                        {beneficiary.emirates_id_number && (
                          <div>
                            <span className="text-muted-foreground">{t('emiratesId')}:</span> {beneficiary.emirates_id_number}
                          </div>
                        )}
                        {beneficiary.comments && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t('comments')}:</span> {capitalizeWords(beneficiary.comments)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                </div>
              )}

              {/* General Beneficiaries (Specific Will) */}
              {answers.general_beneficiaries && answers.general_beneficiaries.length > 0 && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${textAlign(isRtl)}`}>{t('generalBeneficiaries')}</h3>
                  {answers.general_beneficiaries.map((beneficiary: any, index: number) => (
                    <div key={index} className="mb-4 p-4 bg-muted/30 rounded-lg">
                      <div className={`grid grid-cols-2 gap-2 text-sm ${textAlign(isRtl)}`}>
                        <div>
                          <span className="text-muted-foreground">{t('name')}:</span> {capitalizeWords(beneficiary.name)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('relationship')}:</span> {capitalizeWords(beneficiary.relationship)}
                        </div>
                        {beneficiary.passport_number && (
                          <div>
                            <span className="text-muted-foreground">{t('passport')}:</span> {beneficiary.passport_number}
                          </div>
                        )}
                        {beneficiary.asset_description && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t('assetDescription')}:</span> {beneficiary.asset_description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                </div>
              )}

              {/* Assets */}
              {answers.assets && answers.assets.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Assets</h3>
                  {answers.assets.map((asset: Asset, index: number) => (
                    <div key={index} className="mb-4 p-4 bg-muted/30 rounded-lg">
                      <p className="font-medium mb-2">
                        {asset.category.charAt(0).toUpperCase() + asset.category.slice(1)} Asset
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Description:</span>
                          <p className="mt-1">{asset.description}</p>
                        </div>
                        {asset.location && (
                          <div>
                            <span className="text-muted-foreground">Location:</span> {asset.location}
                          </div>
                        )}
                        {asset.estimated_value && (
                          <div>
                            <span className="text-muted-foreground">Estimated Value:</span>{' '}
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD'
                            }).format(asset.estimated_value)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                </div>
              )}

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
