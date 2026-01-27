import { format } from "date-fns";
import { useTranslation } from "react-i18next";
// CSS moved to globals.css for Next.js compatibility

interface WillDocumentPreviewProps {
  answers: any;
  clientName: string;
  willId: string;
  locale?: string;
  status?: string;
  includeSignature?: boolean;
}

export function WillDocumentPreview({ answers, clientName, willId, locale = "en", status, includeSignature = true }: WillDocumentPreviewProps) {
  const { i18n } = useTranslation('pdf');
  const currentDate = new Date();
  const isFinalized = status === 'finalized';
  const isRtl = locale === 'ar';

  // Get translation function for the specified locale (doesn't change global i18n)
  const t = i18n.getFixedT(locale, 'pdf');

  // Helper function to translate enum values
  const translateEnum = (category: string, value: string) => {
    if (!value) return t('notProvided');
    const key = value.toLowerCase().replace(/\s+/g, '');
    const translationKey = `${category}.${key}`;
    const translated = t(translationKey, { defaultValue: value });
    return translated === translationKey ? value : translated;
  };

  // Calculate section offset based on whether assets section is present
  const hasAssetsSection = answers?.will_type === 'specific' && answers?.assets && answers.assets.length > 0;
  const sectionOffset = hasAssetsSection ? 1 : 0;

  return (
    <div className="will-document will-document-preview" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Just Wills Branding Header - Hidden for finalized PDFs */}
      {!isFinalized && (
        <div className="just-wills-brand">
          <div className="brand-logo">
            <div className="logo-icon">JW</div>
            <div className="brand-text">
              <h2 className="brand-name">JUST WILLS</h2>
              <p className="brand-tagline">{t('professionalWillDrafting')}</p>
            </div>
          </div>
          <div className="brand-contact">
            <p>www.justwills.com</p>
            <p>Email: info@justwills.com</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="will-header">
        <h1 className="will-title">{t('lastWillAndTestament')}</h1>
        <div className="will-subtitle">
          <p>{t('of')}</p>
          <p className="testator-name">{clientName || answers?.personal?.full_name || "_______________"}</p>
        </div>
      </div>

      {/* Document Content */}
      <div className="will-content">
        {/* Introduction */}
        <section className="will-section">
          <h2>{t('declaration')}</h2>
          <p className="will-paragraph">
            {t('declarationText', {
              name: clientName || answers?.personal?.full_name,
              address: answers?.personal?.address || "_______________"
            })}
          </p>
        </section>

        {/* Personal Information */}
        <section className="will-section">
          <h2>{t('personalInformation')}</h2>
          {!isRtl ? (
            // LTR Layout (English)
            <div className="info-grid" data-layout="ltr">
              <div className="info-item">
                <span className="info-label">{t('fullName')}</span>
                <span className="info-value">{answers?.personal?.full_name || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('address')}</span>
                <span className="info-value">{answers?.personal?.address || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('email')}</span>
                <span className="info-value">{answers?.personal?.email || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('contactNumber')}</span>
                <span className="info-value">{answers?.personal?.contact_number || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('maritalStatus')}</span>
                <span className="info-value">{translateEnum('maritalStatuses', answers?.personal?.marital_status)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('religion')}</span>
                <span className="info-value">{answers?.personal?.religion || t('notProvided')}</span>
              </div>
            </div>
          ) : (
            // RTL Layout (Arabic) - Reversed column order
            <div className="info-grid" data-layout="rtl">
              <div className="info-item">
                <span className="info-label">{t('address')}</span>
                <span className="info-value">{answers?.personal?.address || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('fullName')}</span>
                <span className="info-value">{answers?.personal?.full_name || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('contactNumber')}</span>
                <span className="info-value">{answers?.personal?.contact_number || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('email')}</span>
                <span className="info-value">{answers?.personal?.email || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('religion')}</span>
                <span className="info-value">{answers?.personal?.religion || t('notProvided')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('maritalStatus')}</span>
                <span className="info-value">{translateEnum('maritalStatuses', answers?.personal?.marital_status)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Executors */}
        {answers?.executors && answers.executors.length > 0 && (
          <section className="will-section">
            <h2>II. {t('appointmentOfExecutors')}</h2>
            <p className="will-paragraph">
              {t('appointExecutorsText')}
            </p>
            {answers.executors.map((executor: any, index: number) => (
              <div key={index} className="person-entry">
                <p className="person-level">{t('level')} {executor.level} {t('executor')}:</p>
                <div className="person-details">
                  <p><strong>{t('name')}</strong> {executor.name}</p>
                  <p><strong>{t('relation')}</strong> {translateEnum('relationships', executor.relation)}</p>
                  <p><strong>{t('email')}</strong> {executor.email}</p>
                  <p><strong>{t('contactNumber')}</strong> {executor.contact_number}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Beneficiaries */}
        {answers?.beneficiaries && answers.beneficiaries.length > 0 && (
          <section className="will-section">
            <h2>{t('distributionOfEstate')}</h2>

            {/* General Will - Simple statement */}
            {(!answers?.will_type || answers?.will_type === 'general') && (
              <p className="will-paragraph">
                {t('generalWillText')}
              </p>
            )}

            {/* Specific Will - Reference to assets */}
            {answers?.will_type === 'specific' && (
              <p className="will-paragraph">
                {t('specificWillText')}
              </p>
            )}

            <p className="will-paragraph">
              {t('giveDeviseBequeathText')}
            </p>

            {/* Group by level */}
            {[1, 2, 3, 4, 5].map((level) => {
              const levelBeneficiaries = answers.beneficiaries.filter((b: any) => b.level === level);
              if (levelBeneficiaries.length === 0) return null;

              return (
                <div key={level} className="beneficiary-level">
                  <h3 className="level-heading">{t('levelBeneficiaries', { level })}</h3>
                  {levelBeneficiaries.map((beneficiary: any, index: number) => (
                    <div key={index} className="beneficiary-entry">
                      <p>
                        <strong>{beneficiary.name}</strong> ({translateEnum('relationships', beneficiary.relationship)}) -{" "}
                        <strong>{beneficiary.percentage}% {t('distribution')}</strong>
                      </p>
                      {beneficiary.comments && (
                        <p className="beneficiary-comments">{t('notes')}: {beneficiary.comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {/* General Beneficiaries - Additional beneficiaries receiving specific assets */}
        {answers?.general_beneficiaries && answers.general_beneficiaries.length > 0 && (
          <section className="will-section">
            <h2>{t('generalBeneficiaries')}</h2>
            <p className="will-paragraph">
              {t('generalBeneficiariesIntro')}
            </p>

            {answers.general_beneficiaries.map((beneficiary: any, index: number) => (
              <div key={beneficiary.id || index} className="beneficiary-entry" style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.05em', color: '#0C5536' }}>
                    {index + 1}. {beneficiary.name}
                  </strong>
                  {beneficiary.relationship && (
                    <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                      ({translateEnum('relationships', beneficiary.relationship)})
                    </span>
                  )}
                </p>

                {beneficiary.asset_description && (
                  <p style={{ margin: '0.5rem 0 0.5rem 1.5rem', fontSize: '0.95em' }}>
                    <span style={{ fontWeight: '600' }}>{t('assetToReceive')}</span> {beneficiary.asset_description}
                  </p>
                )}

                {beneficiary.passport_number && (
                  <p style={{ margin: '0.25rem 0 0 1.5rem', fontSize: '0.9em', color: '#666' }}>
                    <span style={{ fontWeight: '600' }}>{t('passportNumber')}</span> {beneficiary.passport_number}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Assets - Only for Specific Wills */}
        {answers?.will_type === 'specific' && answers?.assets && answers.assets.length > 0 && (
          <section className="will-section">
            <h2>{t('specificAssets')}</h2>
            <p className="will-paragraph">
              {t('specificAssetsIntro')}
            </p>

            {answers.assets.map((asset: any, index: number) => (
              <div key={asset.id || index} className="asset-entry">
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.05em', color: '#0C5536' }}>
                    {index + 1}. {asset.title || 'Unnamed Asset'}
                  </strong>
                  <span className="asset-category-badge">
                    {asset.category}
                  </span>
                </div>

                <div style={{ fontSize: '0.95em', lineHeight: '1.6' }}>
                  {asset.description && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <span style={{ fontWeight: '600' }}>{t('description')}</span> {asset.description}
                    </p>
                  )}

                  {asset.location && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <span style={{ fontWeight: '600' }}>{t('location')}</span> {asset.location}
                    </p>
                  )}

                  {asset.estimated_value && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <span style={{ fontWeight: '600' }}>{t('estimatedValue')}</span> AED {asset.estimated_value.toLocaleString()}
                    </p>
                  )}

                  {asset.beneficiary_name && (
                    <p style={{ margin: '0.5rem 0', color: '#0C5536', fontWeight: '600' }}>
                      → {t('bequeathTo')} {asset.beneficiary_name}
                    </p>
                  )}

                  {!asset.beneficiary_name && (
                    <p style={{ margin: '0.5rem 0', fontStyle: 'italic', color: '#666' }}>
                      {t('distributedAmongBeneficiaries')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Trustees */}
        {answers?.trustees && answers.trustees.length > 0 && !answers?.skip_trustees && (
          <section className="will-section">
            <h2>{t('appointmentOfTrustees')}</h2>
            <p className="will-paragraph">
              {t('appointTrusteesManageText')}
            </p>
            {answers.trustees.map((trustee: any, index: number) => (
              <div key={index} className="person-entry">
                <p className="person-level">{t('levelTrustee', { level: trustee.level })}</p>
                <div className="person-details">
                  <p><strong>{t('name')}</strong> {trustee.name}</p>
                  <p><strong>{t('relation')}</strong> {translateEnum('relationships', trustee.relation)}</p>
                  <p><strong>{t('email')}</strong> {trustee.email}</p>
                  <p><strong>{t('contactNumber')}</strong> {trustee.contact_number}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Guardians - Interim */}
        {answers?.interim_guardians && answers.interim_guardians.length > 0 && (
          <section className="will-section">
            <h2>{hasAssetsSection ? 'VI' : 'V'}. {t('appointmentOfInterimGuardians')}</h2>
            <p className="will-paragraph">
              {t('inEventOfDeathText')}
            </p>
            {answers.interim_guardians.map((guardian: any, index: number) => (
              <div key={index} className="person-entry">
                <p className="person-level">{t('levelInterimGuardian', { level: guardian.level })}</p>
                <div className="person-details">
                  <p><strong>{t('name')}</strong> {guardian.name}</p>
                  <p><strong>{t('relation')}</strong> {guardian.relation}</p>
                  <p><strong>{t('email')}</strong> {guardian.email}</p>
                  <p><strong>{t('contact')}</strong> {guardian.contact_number}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Guardians - Permanent */}
        {answers?.permanent_guardians && answers.permanent_guardians.length > 0 && !answers?.skip_permanent_guardians && (
          <section className="will-section">
            <h2>{hasAssetsSection ? 'VII' : 'VI'}. {t('appointmentOfPermanentGuardians')}</h2>
            <p className="will-paragraph">
              {t('appointPermanentGuardiansText')}
            </p>
            {answers.permanent_guardians.map((guardian: any, index: number) => (
              <div key={index} className="person-entry">
                <p className="person-level">{t('levelPermanentGuardian', { level: guardian.level })}</p>
                <div className="person-details">
                  <p><strong>{t('name')}</strong> {guardian.name}</p>
                  <p><strong>{t('relation')}</strong> {guardian.relation}</p>
                  <p><strong>{t('email')}</strong> {guardian.email}</p>
                  <p><strong>{t('contact')}</strong> {guardian.contact_number}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Assets Schedule (for general will with assets listed) */}
        {answers?.assets && answers.assets.length > 0 && answers?.will_type !== 'specific' && (
          <section className="will-section">
            <h2>{hasAssetsSection ? 'VIII' : 'VII'}. {t('scheduleOfAssets')}</h2>
            <p className="will-paragraph">
              <strong>{t('willType')}:</strong> {t('generalWill')}
            </p>
            <p className="will-paragraph">
              {t('nonExhaustiveListText')}
            </p>

            {answers.assets.map((asset: any, index: number) => (
              <div key={index} className="person-entry" style={{ marginBottom: '1rem' }}>
                <p className="person-level">{t('asset')} {index + 1}:</p>
                <div className="person-details">
                  <p><strong>{t('category')}:</strong> {translateEnum('assetCategories', asset.category)}</p>
                  <p><strong>{t('description')}:</strong> {asset.description}</p>
                  {asset.location && <p><strong>{t('location')}:</strong> {asset.location}</p>}
                  {asset.estimated_value && (
                    <p><strong>{t('estimatedValue')}:</strong> ${asset.estimated_value.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Disinheritance */}
        {answers?.disinherit && answers.disinherit.length > 0 && !answers?.no_disinherit_persons && (
          <section className="will-section">
            <h2>{hasAssetsSection ? 'IX' : 'VIII'}. DISINHERITANCE</h2>
            <p className="will-paragraph">
              I hereby specifically exclude the following person(s) from any benefit under this Will:
            </p>
            {answers.disinherit.map((person: any, index: number) => (
              <div key={index} className="person-entry-simple">
                <p>
                  <strong>{person.name}</strong> ({person.relation})
                  {person.passport_number && ` - Passport: ${person.passport_number}`}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Family Exclusion */}
        {answers?.family_exclusion?.is_excluding && (
          <section className="will-section">
            <h2>IX. FAMILY EXCLUSION CLAUSE</h2>
            <p className="will-paragraph">
              {answers.family_exclusion.details}
            </p>
          </section>
        )}

        {/* Special Requests */}
        {(answers?.special_requests?.funeral_wishes ||
          answers?.special_requests?.guardianship ||
          answers?.special_requests?.digital_assets ||
          answers?.special_requests?.other) && (
          <section className="will-section">
            <h2>X. SPECIAL REQUESTS AND WISHES</h2>

            {answers.special_requests.funeral_wishes && (
              <div className="special-request">
                <h3>Funeral Wishes:</h3>
                <p>{answers.special_requests.funeral_wishes}</p>
              </div>
            )}

            {answers.special_requests.guardianship && (
              <div className="special-request">
                <h3>Guardianship Instructions:</h3>
                <p>{answers.special_requests.guardianship}</p>
              </div>
            )}

            {answers.special_requests.digital_assets && (
              <div className="special-request">
                <h3>Digital Assets:</h3>
                <p>{answers.special_requests.digital_assets}</p>
              </div>
            )}

            {answers.special_requests.other && (
              <div className="special-request">
                <h3>Other Requests:</h3>
                <p>{answers.special_requests.other}</p>
              </div>
            )}
          </section>
        )}

        {/* Letter of Wishes */}
        {answers?.letter_of_wishes?.notes && (
          <section className="will-section">
            <h2>{t('letterOfWishes')}</h2>
            <p className="will-paragraph letter-of-wishes-note">
              <em>{t('letterOfWishesNote')}</em>
            </p>
            <p className="will-paragraph">
              {answers.letter_of_wishes.notes}
            </p>
            <p className="will-paragraph" style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '1rem' }}>
              {t('informationalOnly')}
            </p>
          </section>
        )}
      </div>

      {/* Signature Section */}
      <div className="signature-section">
        <h2>{t('execution')}</h2>
        <p className="execution-text">
          {t('inWitnessWhereof', {
            day: format(currentDate, "do"),
            month: format(currentDate, "MMMM"),
            year: format(currentDate, "yyyy")
          })}
        </p>

        <div className="signature-block">
          <div className="signature-line">
            {includeSignature && answers?.family_exclusion?.signature ? (
              <div className="signature-space">
                <img
                  src={answers.family_exclusion.signature}
                  alt="Testator's Signature"
                  style={{ maxWidth: "100%", height: "auto", maxHeight: "80px" }}
                />
              </div>
            ) : (
              <div className="signature-space">_____________________________</div>
            )}
            <p className="signature-label">{t('testatorSignature')}</p>
            <p className="signature-name">{clientName || answers?.personal?.full_name}</p>
          </div>
        </div>

        <div className="witnesses-section">
          <h3>{t('witnesses')}</h3>
          <p className="witness-text">
            {t('witnessDeclaration')}
          </p>

          <div className="witness-signatures">
            <div className="witness-block">
              <div className="signature-line">
                <div className="signature-space">_____________________________</div>
                <p className="signature-label">{t('witness1Signature')}</p>
              </div>
              <div className="witness-info">
                <p>{t('name')} _____________________________</p>
                <p>{t('address')} _____________________________</p>
                <p>{t('date')} _____________________________</p>
              </div>
            </div>

            <div className="witness-block">
              <div className="signature-line">
                <div className="signature-space">_____________________________</div>
                <p className="signature-label">{t('witness2Signature')}</p>
              </div>
              <div className="witness-info">
                <p>{t('name')} _____________________________</p>
                <p>{t('address')} _____________________________</p>
                <p>{t('date')} _____________________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
