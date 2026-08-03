/**
 * VERBATIM court-template text supplied by JW Legal Consultants' lawyer.
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Produced by scripts/gen-court-template-text.mjs from a run-level extraction
 * of the authoritative Word templates (WILL_AUH_TR.docx / WILL_DXB_TR.docx).
 * To change anything here, change the templates and re-run the generator.
 *
 * This is a legal instrument filed with UAE courts, so the text is carried
 * character-for-character INCLUDING each run's bold / underline formatting:
 * the lawyer's headings are bold with an underlined title, and body paragraphs
 * carry bold emphasis (e.g. "UNITED ARAB EMIRATES"). Renderers must take that
 * formatting from this data and must never fake it with CSS (no uppercasing,
 * no heading rules).
 *
 * The only deviations from the source files are:
 *   - the XML escape "&amp;" is decoded to "&";
 *   - trailing whitespace is trimmed off each paragraph (Word padding);
 *   - a stray "\\" paragraph in the Dubai English section TWO was dropped
 *     (a typographical artifact in the lawyer's file, not legal wording).
 *
 * The underscore runs ("________") are the drafter's blanks and are preserved
 * exactly, with their own formatting. buildCourtWillDocument() in
 * ./courtTemplate.ts substitutes form data into them positionally, preserving
 * the formatting of the run each blank sits in; any blank with no data keeps
 * its original underscores.
 *
 * Structure per jurisdiction:
 *   cover      - Abu Dhabi only: the cover page (English block | Arabic block).
 *                In the source the cover table carries <w:bidiVisual/> with the
 *                Arabic cell first, which Word displays English-left — so it is
 *                stored here English-first like everything else.
 *   preamble   - the "I, ____ ..." identification line
 *   sections   - the 14 numbered sections, index 0 = ONE/أولاً .. 13 = FOURTEEN/رابع عشر.
 *                Each section's first paragraph is its own heading.
 *                Section 13 stops after FINALLY / أخيرا; the NAME/SIGNATURE block and
 *                the court attestation block that follow it in the source are held
 *                separately (see `court` below and the execution block in
 *                courtTemplate.ts) because the renderers must inject a
 *                signature image there.
 *   court      - Abu Dhabi only: the "To be completed by the Court" block, as
 *                English/Arabic label pairs in source order.
 */

/** One formatting run: a span of text with optional bold / underline. */
export type WillRun = { t: string; b?: 1; u?: 1 };

/** One paragraph: an ordered list of runs. Concatenating `t` gives the text. */
export type WillPara = WillRun[];

export type CourtTemplateBlock = { en: WillPara[]; ar: WillPara[] };

export type CourtTemplateText = {
  cover: CourtTemplateBlock | null;
  preamble: CourtTemplateBlock;
  sections: CourtTemplateBlock[];
  court: { en: WillPara; ar: WillPara }[] | null;
};


export const COURT_TEMPLATE_TEXT: Record<"abu_dhabi" | "dubai", CourtTemplateText> = {
  "abu_dhabi": {
    cover: {
      en: [
        [{ t: "LAST WILL AND", b: 1 }],
        [{ t: "TESTAMENT OF", b: 1 }],
        [{ t: "Client’s Full Name", b: 1 }],
        [{ t: "JW Legal Consultants LLC", b: 1 }],
        [{ t: "Abu Dhabi, United Arab Emirates", b: 1 }],
        [{ t: "[94557]" }, { t: " " }, { t: "800 " }, { t: "wills", b: 1 }],
        [{ t: "info@ just- wills.net" }],
      ],
      ar: [
        [{ t: "الوصيّة الختامية الخاصة بـ", b: 1 }],
        [{ t: "الاسم الكامل للعميل", b: 1 }],
        [{ t: "جي دبليو للاستشارات القانونية ذ.م.م.", b: 1 }],
        [{ t: "ا", b: 1 }, { t: "بوظبي، ا", b: 1 }, { t: "لإمارات العربية المتحدة", b: 1 }],
        [{ t: "[94557]" }, { t: " " }, { t: "800 " }, { t: "wills", b: 1 }],
        [{ t: "info@ just- wills.net" }],
      ],
    },
    preamble: {
      en: [
        [{ t: "I, " }, { t: "________, ", b: 1 }, { t: "National, born on _______, holder of Passport No: " }, { t: "______,", b: 1 }, { t: " " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " _______, ", b: 1 }, { t: "residing at __________" }, { t: "," }, { t: " UNITED ARAB EMIRATES" }, { t: "," }, { t: " in order to settle the succession of my estate upon my death do provide as follows, namely" }, { t: ":" }],
      ],
      ar: [
        [{ t: "أنا" }, { t: "،" }, { t: " ", b: 1 }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "________", b: 1 }, { t: " الجنسية،" }, { t: " " }, { t: "المولود " }, { t: "في " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "حامل" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "، ", b: 1 }, { t: "وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "مقيم", b: 1 }, { t: " ", b: 1 }, { t: "في", b: 1 }, { t: " ", b: 1 }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "دولة " }, { t: "الإمارات العربية المتحدة،" }, { t: " " }, { t: "أكتب هذه الوصية من أجل " }, { t: "تسوية" }, { t: " وراثة ممتلكاتي " }, { t: "بعد وفاتي، وذلك" }, { t: " حسب الشروط والأحكام التالية" }, { t: "،" }, { t: " تحديداً:" }],
      ],
    },
    court: [
      { en: [{ t: "To be completed by the Court:", b: 1 }], ar: [{ t: "للاستكمال من قبل المحكمة", b: 1 }] },
      { en: [{ t: "Name of Attestation Officer:" }], ar: [{ t: "اسم الموثق:" }] },
      { en: [{ t: "Will Registration Number:" }], ar: [{ t: "رقم " }, { t: "تصديق الوصية" }, { t: ":" }] },
      { en: [{ t: "Signature:" }], ar: [{ t: "التوقيع:" }] },
      { en: [{ t: "Date:" }], ar: [{ t: "التاريخ" }, { t: ":" }] },
    ],
    sections: [
      {
        en: [
          [{ t: "ONE:", b: 1 }, { t: " " }, { t: "Declaration", b: 1, u: 1 }],
          [{ t: "Being of sound mind and memory and over the age of twenty-one (21) years and not being actuated by any duress, menace, fraud, mistake, or undue influence, do make, publish, and declare that this Will is made for the purpose only of settling the succession of my estate situated or arising in " }, { t: "the " }, { t: "UNITED ARAB EMIRATES", b: 1 }, { t: " only. Any Wills made prior to this Will, relating to my estate in the " }, { t: "UAE", b: 1 }, { t: " are now cancelled" }, { t: "." }],
        ],
        ar: [
          [{ t: "أولاً: ", b: 1 }, { t: "إعلان", b: 1, u: 1 }],
          [{ t: "أكتب وصيتي هذه بمحض إرادتي وأنا بكامل قواي العقلية وبذاكرة سليمة، وفي سن تعد" }, { t: "ت" }, { t: " ال" }, { t: "حادي والعشرين " }, { t: "(" }, { t: "21" }, { t: ") " }, { t: "عاما" }, { t: "، ومن دون أن أتعرض لأي نوع من الإكراه أو التهديد أو التأثير غير المشروع أو أن يكون لدي رغبة في الاحتيال أو بارتكاب أي خطأ، أقر وأعلن أن" }, { t: " " }, { t: "ه" }, { t: "ذه الوصية هي فقط" }, { t: " لغرض تسوية" }, { t: " وراثة" }, { t: " " }, { t: "ممتلكاتي" }, { t: " الموجودة" }, { t: " أو الناشئة" }, { t: " " }, { t: "في" }, { t: " ", b: 1 }, { t: "دولة ", b: 1 }, { t: "الإمارات العربية المتحدة", b: 1 }, { t: " ", b: 1 }, { t: "فقط" }, { t: "." }, { t: " ", b: 1 }, { t: "و" }, { t: "أي وص" }, { t: "ايا كتبتها " }, { t: "قبل هذه " }, { t: "الوصية فيما يتعلق بممتلكاتي في " }, { t: "دولة ", b: 1 }, { t: "الإمارات العربية المتحدة", b: 1 }, { t: " ", b: 1 }, { t: "تعتبر لاغية" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "TWO:", b: 1 }, { t: " " }, { t: "Appointment of Executors and Trustees", b: 1, u: 1 }],
          [{ t: "I appoint my " }, { t: "___________", b: 1 }, { t: ", " }, { t: "National, born on " }, { t: "____", b: 1 }, { t: ", holder of Passport No: " }, { t: "_____", b: 1 }, { t: ", " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " " }, { t: "______, ", b: 1 }, { t: "to be my executrix and trustee, but if he/she is unable or unwilling to act or if he/she dies before proving my Will, the following provision shall apply instead." }],
          [{ t: "I appoint" }, { t: " ", b: 1 }, { t: "my " }, { t: "____", b: 1 }, { t: " " }, { t: "______, ", b: 1 }, { t: "National, " }, { t: "born on ______, " }, { t: "holder of Passport No: " }, { t: "_____", b: 1 }, { t: ", " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " " }, { t: "______, ", b: 1 }, { t: "to act as my substitute executor and trustee." }],
          [{ t: "If all my above appointed executors and trustees are unable or unwilling to act or if they shall die before proving my Will, I revoke their appointments and I make the following further appointment instead" }, { t: "." }],
          [{ t: "I appoint _____, to act as my substitute executor and trustee." }],
          [{ t: "I appoint as my Executors the company known as JW Legal Consultants LLC, Abu Dhabi, United Arab Emirates or the limited company, incorporated practice or firm that, at the time of my death, has succeeded to and continues to carry on its practice. " }, { t: "(OPTIONAL)" }],
          [{ t: "Any executors or trustees acting under my Will are referred to as \"my trustees\"" }, { t: "." }],
        ],
        ar: [
          [{ t: "ثانياً: ", b: 1 }, { t: "تعيين المنفذين والأوصياء", b: 1, u: 1 }],
          [{ t: "أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "، " }, { t: "________", b: 1 }, { t: " الجنسية،" }, { t: " " }, { t: "المولود " }, { t: "في " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "حامل" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "ل" }, { t: "ت" }, { t: "كون المنفّذ" }, { t: "ة" }, { t: " والوصي" }, { t: "ة" }, { t: " " }, { t: "على وصيتي، ولكنه" }, { t: "/" }, { t: "ولكنه" }, { t: "ا" }, { t: " إذا كان" }, { t: "ت" }, { t: " غير قادر" }, { t: "ة" }, { t: " على ذلك أو غير راغب" }, { t: "ة" }, { t: " فيه" }, { t: " أو إذا ما" }, { t: "ت" }, { t: "/مات" }, { t: "ت" }, { t: " قبل تنفيذ وصيتي،" }, { t: " " }, { t: "يُ" }, { t: "طبّق البند التالي بدلاً من ذلك" }, { t: "." }],
          [{ t: "أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "، " }, { t: "________", b: 1 }, { t: " الجنسية،" }, { t: " " }, { t: "المولود " }, { t: "في " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "حامل" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "ل" }, { t: "ي" }, { t: "كون" }, { t: " " }, { t: "المنفّذ" }, { t: " " }, { t: "وال" }, { t: "و" }, { t: "صي" }, { t: " " }, { t: "البديل" }, { t: " " }, { t: "على وصيتي" }, { t: "." }],
          [{ t: "إذا كان جميع منفذ" }, { t: "يّ" }, { t: " وأوصيائي" }, { t: " المعينين أعلاه غير قادرين على التصرف أو غير راغبين فيه أو إذا " }, { t: "توفوا" }, { t: " قبل تنفيذ وصيتي" }, { t: "،" }, { t: " فإنني ألغي تعيين" }, { t: "ات" }, { t: "هم وأجري التعيين التالي بدلاً من ذلك" }, { t: "." }],
          [{ t: "أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "ل" }, { t: "ي" }, { t: "كون" }, { t: " " }, { t: "المنفّذ" }, { t: " " }, { t: "وال" }, { t: "وصي البديل " }, { t: "على وصيتي" }, { t: "." }],
          [{ t: "أعيّن" }, { t: "، " }, { t: "كمنفذ" }, { t: "يّ، " }, { t: "الشركة المعروفة باسم " }, { t: "     " }, { t: "جي دبليو للاستشارات القانونية ذ.م.م" }, { t: "،" }, { t: " أبو ظبي" }, { t: "، الإمارات العربية المتحدة أو الشركة المحدودة أو المكتب المهني المدمج أو المؤسسة التي تكون قد خلفتها قانونًا وتواصل مزاولة نشاطها المهني في وقت وفاتي" }, { t: "." }, { t: " " }, { t: "(اختياري)" }],
          [{ t: "أي منفذين أو" }, { t: " " }, { t: "أوصياء يعملون وفقاً لوصيتي يُشار إليهم باسم \"أوصيائي" }, { t: "\"" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "THREE: ", b: 1 }, { t: "Debts and Funeral Expenses", b: 1, u: 1 }],
          [{ t: "I direct my trustee(s) to make payment of any of my lawful debts and/or funeral expenses and any expenses for the winding up of my estate" }, { t: "." }],
        ],
        ar: [
          [{ t: "ثالثاً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "الديون ونفقات الجنازة", b: 1, u: 1 }],
          [{ t: "أوجه " }, { t: "وصيّي (" }, { t: "أوصيائي" }, { t: ")" }, { t: " بأداء" }, { t: " أي من" }, { t: " ديوني القانونية و" }, { t: "/أو " }, { t: "نفقات " }, { t: "الجنازة " }, { t: "و" }, { t: "أي " }, { t: "نفقات " }, { t: "ل" }, { t: "تصفية" }, { t: " " }, { t: "تركتي" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "FOUR", b: 1 }, { t: ":" }, { t: "  " }, { t: "Letter of Wishes", b: 1, u: 1 }],
          [{ t: "I direct my trustees to give effect to any writings granted by me, however informal they may be provided they are signed by me, dated after the date hereof and are clearly expressive of my intention, as to which my trustees shall be the sole judges. Any bequests so made shall be free of interest, delivery expenses and government taxes unless otherwise stipulated" }, { t: "." }],
        ],
        ar: [
          [{ t: "رابعاً", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "خطاب الرغبات", b: 1, u: 1 }],
          [{ t: "أوجه أوصيائي بتنفيذ أي " }, { t: "تفويضات منحتُها " }, { t: "مهما كانت غير رسمية" }, { t: "،" }, { t: " على أن تكون موقعة من طرفي، وتحمل تاريخا " }, { t: "لاحقا" }, { t: " لتاريخ هذه الوصية وتفص" }, { t: "ح بج" }, { t: "لاء عن " }, { t: "نيتي" }, { t: " والتي سيكون أوصيائي هم الوحيد" }, { t: "و" }, { t: "ن المخول لهم " }, { t: "ال" }, { t: "حكم بشأنها." }, { t: " " }, { t: "أي هبات إيصائية يتم إعدادها بهذه الكيفية ستكون معفاة من الفوائد ونفقات التسليم والضرائب الحكومية، ما لم ينص على خلاف ذلك." }],
        ],
      },
      {
        en: [
          [{ t: "FIVE:", b: 1 }, { t: " " }, { t: "Law", b: 1, u: 1 }],
          [{ t: "The Law of the United Arab Emirates (UAE) applies" }, { t: "." }],
          [{ t: "Sharia Law will not be applied; the wishes outlined in this Last Will and Testament shall be " }, { t: "honored" }, { t: "." }],
          [{ t: "The substantive provisions governing testamentary disposition and other dispositions taking effect after my death shall be governed in accordance with the provisions of this Will" }, { t: "." }],
        ],
        ar: [
          [{ t: "خامساً", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "ال", b: 1, u: 1 }, { t: "قانون", b: 1, u: 1 }],
          [{ t: "يطبّق قانون دولة الإمارات العربية المتحدة (إ.ع.م)." }],
          [{ t: "ل" }, { t: "ا" }, { t: " يتم تطبيق الشريعة الإسلامية، وي" }, { t: "تم" }, { t: " احترام الرغبات الموضحة في هذه الوصية" }, { t: " " }, { t: "الأخيرة" }, { t: "." }],
          [{ t: "ا" }, { t: "لأحكام الموضوع" }, { t: "ية التي تحكم التصرف" }, { t: "ات" }, { t: " الإيصائي" }, { t: "ة" }, { t: " و" }, { t: "التصرفات" }, { t: " الأخرى التي قد تصبح نافذة بعد وفاتي ستخضع " }, { t: "لبنود هذه الوصية." }],
        ],
      },
      {
        en: [
          [{ t: "SIX: ", b: 1 }, { t: "Religion & Faith", b: 1, u: 1 }],
          [{ t: "I confirm that I am a Non/Muslim and ____ by Faith" }, { t: "." }],
        ],
        ar: [
          [{ t: "سادساً", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "الدين والعقيدة", b: 1, u: 1 }],
          [{ t: "أؤكد أنني" }, { t: " غير مسلم" }, { t: "/مسلم" }, { t: " ومن أتباع العقيدة " }, { t: "________", b: 1 }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "SEVEN", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "Entitlements of Insurance Proceeds", b: 1, u: 1 }],
          [{ t: "I direct my trustees that all proceeds from any insurance policies shall be distributed according to the existing nomination/beneficiary form filled up by me and in the absence of such form, the following beneficiary provisions of this Will shall apply instead" }, { t: "." }],
        ],
        ar: [
          [{ t: "سابعاً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "مستحقات إيرادات التأمين", b: 1, u: 1 }],
          [{ t: "أوجّه أوصيائي بأن يتم توزيع جميع الإيرادات المتأتية من أيّ بوالص تأمين وفق نموذج الترشيح/ الانتفاع الحالي الذي تم تعبئته من قبلي وفي حال عدم وجود هذا النموذج " }, { t: "ي" }, { t: "نطبق " }, { t: "بنود الإنتفاع التالية" }, { t: " من هذه الوصية بدلاً من ذلك." }],
        ],
      },
      {
        en: [
          [{ t: "EIGHT", b: 1 }, { t: ": ", b: 1 }, { t: "Distribution of My Estate", b: 1, u: 1 }],
          [{ t: "I direct my trustees to make over the whole remainder of my means and estate, moveable and non-moveable properties, all financial assets including but not limited to bank accounts, including savings, current and fixed deposits and investment accounts any other accounts, motorcycles, motor cars, art and antiques, jewels, " }, { t: "jewellery" }, { t: ", furniture and fixtures, debentures, leasehold, bonds, security lockers, stocks, shares, investments, copyrights, intangible assets, inheritances, mutual funds, capital, death in service benefits, gratuity payments, reserves and any shareholding in any companies and any other assets" }, { t: " " }, { t: "to my " }, { t: "____", b: 1 }, { t: " " }, { t: "________", b: 1 }, { t: " (100%) one hundred percentage share " }, { t: "absolutely." }],
        ],
        ar: [
          [{ t: "ثامناً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "توزيع تركتي", b: 1, u: 1 }],
          [{ t: "أوجّه أوصيائي بأن يحوّلوا كل الباقي من أموالي " }, { t: "وتركتي" }, { t: "، " }, { t: "الممتلكات " }, { t: "المنقولة وغير المنقولة وكافة الأصول المالية " }, { t: "بما في ذلك على سبيل المثال لا الحصر الحسابات المصرفية" }, { t: "،" }, { t: " " }, { t: "بما في ذلك حسابات التوفير والودائع الجارية والثابتة" }, { t: " وحسابات الإستثمار" }, { t: " وأيّ حسابات أخرى والدراجات النارية والسيارات والقطع الفنية والأثرية" }, { t: " " }, { t: "والحلي" }, { t: " " }, { t: "والمجوهرات" }, { t: " " }, { t: "والأثاث والتجهيزات وسندات الدين وأثمان الإيجار والصكوك" }, { t: " " }, { t: "وخزائن الإيداع الآمن والسندات والأسهم والاستثمارات " }, { t: "و" }, { t: "حقوق الطبع والنشر والأصول غير الملموسة" }, { t: " " }, { t: "والتركات" }, { t: " وصناديق الإستثمار و" }, { t: "رؤ" }, { t: "و" }, { t: "س الأموال وتعويضات الوفاة على رأس العمل ومكافآت نهاية الخدمة والمدخرات وأيّ حصص في أيّ شركات " }, { t: "وأيّ أصول أخرى" }, { t: " " }, { t: "إلى " }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "بنسبة" }, { t: " " }, { t: "(100%)" }, { t: " " }, { t: "مائة  بالمائة " }, { t: "من الحصص " }, { t: "بشكل مطلق" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "NINE: ", b: 1 }, { t: "If " }, { t: "my wife " }, { t: "_________", b: 1 }, { t: " does not survive me, but in such event only, I direct my trustees to make over the whole remainder of my means and estate in the following manner" }, { t: ":" }],
          [{ t: "As to (50%) fifty percentage shares of my estate to my" }, { t: " " }, { t: "_______", b: 1 }, { t: " absolutely and in the event of " }, { t: "her/him", b: 1 }, { t: " not surviving me or failing to take a vested interest then to" }, { t: " her", b: 1 }, { t: "/" }, { t: "his", b: 1 }, { t: " biological children" }, { t: " " }, { t: "as shall survive me to share equally among them if more than one. " }, { t: "– optional" }],
          [{ t: "As to (50%) fifty percentage shares of my estate to " }, { t: "my" }, { t: " " }, { t: " _", b: 1 }, { t: "______", b: 1 }, { t: " absolutely and in the event of " }, { t: "her/him", b: 1 }, { t: " not surviving me or failing to take a vested interest then to " }, { t: "her/his", b: 1 }, { t: " biological children" }, { t: " " }, { t: "as shall survive me to share equally among them if more than one. " }, { t: "– optional" }],
          [{ t: "If any part of my estate falls to a beneficiary who has not attained the legal age of majority, my trustees shall hold the same in trust for this beneficiary until the legal age of majority is attained." }],
          [{ t: "Income arising from such share shall be accumulated by my trustees who may apply all or part of the income or capital of this share for the maintenance, education or benefit of this beneficiary." }],
          [{ t: "In the event of any of the foregoing shares of the residue remain undisposed of by the preceding provisions, such share shall be " }, { t: "distributed to the other " }, { t: "beneficiaries" }, { t: " pro rata according to their shares." }],
        ],
        ar: [
          [{ t: "تاسعا", b: 1 }, { t: ": ", b: 1 }, { t: "إذا لم " }, { t: "ت" }, { t: "عش " }, { t: "زوجتي" }, { t: " ", b: 1 }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "من بعدي" }, { t: "، ولكن في هذه الحالة فقط،" }, { t: " فإني أوجّه أوصيائي بأن يحولوا " }, { t: "كل" }, { t: " الباقي من أموالي وممتلكاتي" }, { t: " على النحو التالي:" }],
          [{ t: "نسبة" }, { t: " " }, { t: "(50%)" }, { t: " " }, { t: "خمسين" }, { t: " بالمائة" }, { t: " " }, { t: "من حصص " }, { t: "تركتي" }, { t: " إلى" }, { t: " " }, { t: "________", b: 1 }, { t: " " }, { t: "بشكل مطلق" }, { t: " " }, { t: "وفي حال " }, { t: "لم ", b: 1 }, { t: "ت", b: 1 }, { t: "عش", b: 1 }, { t: "/ ", b: 1 }, { t: "لم ", b: 1 }, { t: "ي", b: 1 }, { t: "عش", b: 1 }, { t: " " }, { t: "من بعدي أو تعذر حصول" }, { t: "ه" }, { t: " على حصة مكتسبة" }, { t: "، فعندئذ إلى " }, { t: "أبنائه", b: 1 }, { t: "ا/أبنائه", b: 1 }, { t: " ", b: 1 }, { t: "البيولوجيين" }, { t: "، " }, { t: "إذا عاش" }, { t: "و" }, { t: "ا من بعدي،" }, { t: " ت" }, { t: "قسم بينهم بأنصبة متساوية" }, { t: "، " }, { t: "إذا زاد عددهم عن واحد" }, { t: "." }, { t: " - " }, { t: "اختياري" }],
          [{ t: "نسبة " }, { t: "(50%)" }, { t: " خمسين بالمائة" }, { t: " " }, { t: "من حصص تركتي إلى " }, { t: "________", b: 1 }, { t: " " }, { t: "بشكل مطلق " }, { t: "وفي حال " }, { t: "لم ", b: 1 }, { t: "ت", b: 1 }, { t: "عش", b: 1 }, { t: "/ ", b: 1 }, { t: "لم ", b: 1 }, { t: "ي", b: 1 }, { t: "عش", b: 1 }, { t: " " }, { t: "من بعدي أو تعذر حصول" }, { t: "ه" }, { t: " على حصة مكتسبة" }, { t: "، فعندئذ إلى " }, { t: "أبنائها/أبنائه ", b: 1 }, { t: "البيولوجيين" }, { t: "، " }, { t: "إذا عاش" }, { t: "و" }, { t: "ا من بعدي،" }, { t: " ت" }, { t: "قسم بينهم بأنصبة متساوية" }, { t: "، " }, { t: "إذا زاد عددهم عن واحد" }, { t: "." }, { t: " " }, { t: "–" }, { t: " " }, { t: "اختياري" }],
          [{ t: "إ" }, { t: "ذا آل أي جزء من" }, { t: " " }, { t: "ممتلكاتي إلى منتفع لم يبلغ" }, { t: " سن" }, { t: " " }, { t: "الرشد القانوني،" }, { t: " " }, { t: "سوف " }, { t: "يحتفظ أوصيائي بذلك الجزء كأمانة لصالح ذلك المستفيد لحين بلوغه " }, { t: "سن" }, { t: " " }, { t: "الرشد القانوني" }, { t: "." }],
          [{ t: "يحتفظ أوصيائي بالدخل الناشئ عن هذه الحصة " }, { t: "و" }, { t: "يجوز" }, { t: " لهم" }, { t: " استخدام كل أو بعض من دخل" }, { t: " هذه الحصة" }, { t: " أو رأسمالها من أجل إعالة" }, { t: " ذلك " }, { t: "المنتف" }, { t: "ع" }, { t: " " }, { t: "أو " }, { t: "تعليمه " }, { t: "أو " }, { t: "تحقيق مصالحه" }, { t: "." }],
          [{ t: "في " }, { t: "حال بقاء أي من الحصص المذكورة أعلاه من الباقي بدون توزيع بموجب البنود السابقة" }, { t: "، يتم توزيع تلك الحصص إلى" }, { t: " " }, { t: "المنتفعين" }, { t: " الآخرين " }, { t: "تناسبياً وفقاً لحصة كل منه" }, { t: "م." }],
        ],
      },
      {
        en: [
          [{ t: "TEN:", b: 1 }, { t: " " }, { t: "In the event of no person or persons above referred to taking a vested interest in my estate, I direct my trustees to make over the whole remainder of my means and estate " }, { t: "to _________, absolutely. " }, { t: "(OPTIONAL)" }],
        ],
        ar: [
          [{ t: "عاشرا", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "إذا لم يحصل " }, { t: "أي " }, { t: "شخص أو أشخاص " }, { t: "من المذكورين أعلاه على حصة مكتسبة في" }, { t: " تركتي،" }, { t: " " }, { t: "أوجّه أوصيائي بأن يحولوا كل الباقي من" }, { t: " أموالي وممتلكاتي" }, { t: " " }, { t: "________", b: 1 }, { t: " " }, { t: "بشكل مطلق." }, { t: " " }, { t: "(اختياري)" }],
        ],
      },
      {
        en: [
          [{ t: "ELEVEN", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "If any part of my estate is held for a beneficiary who lacks full legal capacity, my trustees shall have following powers: -" }],
          [{ t: "To pay or apply any part of the income or capital falling to that beneficiary for his or her benefit in any manner my trustees think proper." }],
          [{ t: "To retain the same until such capacity is attained, accumulating income with capital, or" }],
          [{ t: "To pay over the same to the legal guardian or the person for the time being having the custody of that beneficiary, whose receipt shall be a sufficient discharge to my trustees." }],
        ],
        ar: [
          [{ t: "حادي ", b: 1 }, { t: "ع", b: 1 }, { t: "شر", b: 1 }, { t: ": ", b: 1 }, { t: "إذا احتفظ أوصيائي بأي جزء من تركتي لصالح منتفع يفتقر للأهلية القانونية الكاملة، فسيكون لأوصيائي " }, { t: "ال" }, { t: "صلاحي" }, { t: "ات التالية" }, { t: ":" }],
          [{ t: "أداء أو استخدام أي جزء من الإيراد أو رأس المال الآيل لذلك المنتفع لما فيه مصلحته أو مصلحتها بالطريقة التي يراها أوصيائي مناسبة." }],
          [{ t: "الإبقاء على ذلك الجزء إلى حين بلوغه الأهلية المطلوبة مع إضافة الإيراد إلى رأس المال، أو" }],
          [{ t: "أداء الجزء المذكور إلى الوصي الشرعي أو الشخص الذي له حق الوصاية على ذلك المنتفع في تلك المرحلة، وسيكون في الإيصال الصادر عن أي منهما إبراء كافياً لذمة أوصيائي" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "TWELVE", b: 1 }, { t: ":", b: 1 }],
          [{ t: "My " }, { t: "trustees shall have the fullest powers of retention, realisation, investment, transfer of property without consideration, and management of my estate as if they were absolute owners and not trustees. However, all proceeds are for the beneficiaries only." }],
          [{ t: "My trustees may appoint one or more executor of their own number to act as solicitor or agent in any other capacity and " }, { t: "allow that trustee the same remuneration, as to which that trustee would have been entitled to." }],
        ],
        ar: [
          [{ t: "ثان", b: 1 }, { t: "ي ", b: 1 }, { t: "عشر", b: 1 }, { t: ":", b: 1 }],
          [{ t: "لأوصيائي الصلاحية المطلقة للاحتفاظ " }, { t: "بالممتلكات و" }, { t: "تسييل" }, { t: "ها" }, { t: " " }, { t: "وإ" }, { t: "ستثمارها وتحويل" }, { t: "ها" }, { t: " دون " }, { t: "مقابل" }, { t: " وإدار" }, { t: "ة تركتي" }, { t: " كما لو كانوا يملكونها فعلا و ليسوا " }, { t: "أوصياء" }, { t: ". ولكن تكون جميع الإيرادات لصالح المنتفعين فقط." }],
          [{ t: "يمكن لأوصيائي تعيين واحد منهم أو أكثر ليكون محامياً أو وكيلاً بأي صفة أخرى " }, { t: "وتخصيص نفس الراتب لذلك " }, { t: "الوصي" }, { t: " الذي كان يحق له أن يحصل عليه" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "THIRTEEN: ", b: 1 }, { t: "Guardianship Appointments", b: 1, u: 1 }],
          [{ t: "Upon my demise, I appoint my " }, { t: "_______", b: 1 }, { t: " to act as permanent guardian " }, { t: "of my children as follows:" }],
          [{ t: "My child __________." }],
          [{ t: "My child __________." }],
          [{ t: "In the event of " }, { t: "her/him", b: 1 }, { t: " predeceasing me or being unable or unwilling to act, I appoint my __________, to act as permanent guardian of my children if they are under the age of full capacity at the time of my death." }],
          [{ t: "However, if the appointed permanent guardians above-mentioned are unable to act and take the custody of my children, for the interim period only, I appoint my" }, { t: "__________,", b: 1 }, { t: " " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " " }, { t: "________,", b: 1 }, { t: " " }, { t: "to act as interim guardian of my children" }, { t: " " }, { t: "and in the event of " }, { t: "her/him", b: 1 }, { t: " predeceasing me or being unable or unwilling to act, I appoint my" }, { t: "__________, ", b: 1 }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: "_________,", b: 1 }, { t: " ", b: 1 }, { t: "to act as interim guardian of my children if they are under the age of full capacity at the time of my death." }],
          [{ t: "This interim guardianship appointment will apply until the permanent guardians will be able to act and take over the custody of my children." }],
        ],
        ar: [
          [{ t: "ثالث عشر:  ", b: 1 }, { t: "تعيينات الوصاية", b: 1, u: 1 }],
          [{ t: "في وقت وفاتي" }, { t: "،" }, { t: " فإني" }, { t: " أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "ل" }, { t: "ي" }, { t: "كون" }, { t: " " }, { t: "الوصي" }, { t: "ّ " }, { t: "الدائم" }, { t: " " }, { t: "على" }, { t: " " }, { t: "أ" }, { t: "بن" }, { t: "ائ" }, { t: "ي" }, { t: " " }, { t: "كما يلي:" }],
          [{ t: "إبني ", b: 1 }, { t: "________", b: 1 }],
          [{ t: "إبني ", b: 1 }, { t: "________", b: 1 }],
          [{ t: "وف" }, { t: "ي حال" }, { t: " " }, { t: "توفي", b: 1 }, { t: "ت/ توفي", b: 1 }, { t: " قبلي أو" }, { t: " كان غير قادر" }, { t: " على ذلك أو غير راغب فيه، " }, { t: "أعين" }, { t: " " }, { t: "________", b: 1 }, { t: "، " }, { t: "ل" }, { t: "ي" }, { t: "كون" }, { t: " " }, { t: "الوصي" }, { t: "ّ " }, { t: "الدائم" }, { t: " " }, { t: "على" }, { t: " " }, { t: "أ" }, { t: "بن" }, { t: "ائ" }, { t: "ي" }, { t: "، " }, { t: "إذا ك" }, { t: "ان" }, { t: "وا" }, { t: " تحت سن الأهلية" }, { t: " الكاملة " }, { t: "عند وفاتي" }, { t: "." }],
          [{ t: "ولكن، إذا كان الأوصياء الدائمون المعيّنون المذكورون أعلاه غير قادرين عل" }, { t: "ى" }, { t: " التصرّف" }, { t: " " }, { t: "وتولي " }, { t: "حضانة" }, { t: " أ" }, { t: "بنائي، " }, { t: "للفترة الإنتقالية فقط،" }, { t: " أعين" }, { t: " " }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "حامل ", b: 1 }, { t: "بطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "ل" }, { t: "ي" }, { t: "كون الوصيّ " }, { t: "المؤقت" }, { t: " على" }, { t: " ", b: 1 }, { t: "أ", b: 1 }, { t: "بن" }, { t: "ائ" }, { t: "ي، وف" }, { t: "ي حال" }, { t: " " }, { t: "توفي", b: 1 }, { t: "ت/توفي", b: 1 }, { t: " قبلي أو" }, { t: " كان غير قادر" }, { t: " على ذلك أو غير راغب فيه، " }, { t: "أعين" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " ", b: 1 }, { t: "حامل ", b: 1 }, { t: "بطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "ل" }, { t: "ي" }, { t: "كون الوصيّ " }, { t: "المؤقت" }, { t: " على" }, { t: " ", b: 1 }, { t: "أ", b: 1 }, { t: "بنائي،" }, { t: " " }, { t: "إذا ك" }, { t: "ان" }, { t: "وا" }, { t: " تحت سن الأهلية" }, { t: " الكاملة " }, { t: "عند وفاتي" }, { t: "." }],
          [{ t: "ويسري هذ" }, { t: "ا" }, { t: " التعيين للوصاية المؤقتة " }, { t: "إل" }, { t: "ى" }, { t: " أن يصبح " }, { t: "الاوصياء الدائمون " }, { t: "قادرين على التصرف وتولي " }, { t: "حضانة" }, { t: " " }, { t: "أبنائي" }, { t: ".", b: 1 }],
        ],
      },
      {
        en: [
          [{ t: "FOURTEEN: ", b: 1 }, { t: "I " }, { t: "hereby declare that, in the event of a divorce, my, " }, { t: "_______", b: 1 }, { t: ", shall not be entitled to receive or claim any funds or assets from my estate. " }, { t: "(OPTIONAL)" }],
          [{ t: "Declaration clause", b: 1, u: 1 }],
          [{ t: "I " }, { t: "hereby declare " }, { t: "that," }, { t: " I have made no provision for " }, { t: "my" }, { t: " " }, { t: "____", b: 1 }, { t: "______", b: 1 }, { t: " in my Will " }, { t: "and he" }, { t: " ", b: 1 }, { t: "shall not be entitled to receive or claim any funds or assets from my estate." }],
          [{ t: "FINALLY", b: 1 }, { t: ": ", b: 1 }, { t: "I " }, { t: "declare that my country of citizenship is _____ and I’m residing in the United Arab Emirates (UAE) at the time of writing this Will" }, { t: "." }],
        ],
        ar: [
          [{ t: "رابع عشر", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "أ" }, { t: "علن" }, { t: " " }, { t: "بموجب هذا أنه في حالة طلاق" }, { t: "، " }, { t: "ل" }, { t: "ا" }, { t: " " }, { t: "يكون" }, { t: " " }, { t: "_______", b: 1 }, { t: " مستحقا" }, { t: " لتلقي" }, { t: " أو " }, { t: "مطالبة أي أموال" }, { t: " أو أصول" }, { t: " من تركتي" }, { t: "." }, { t: " " }, { t: "(اختياري)" }],
          [{ t: "بند الإعلان", b: 1, u: 1 }],
          [{ t: "أ" }, { t: "علن" }, { t: " " }, { t: "بموجب هذا أنه" }, { t: " لم أقم بأي تخصيص لصالح " }, { t: "_______", b: 1 }, { t: " في " }, { t: "وصيتي" }, { t: " " }, { t: "و" }, { t: "ل" }, { t: "ا" }, { t: " " }, { t: "يكون مستحقا" }, { t: " لتلقي" }, { t: " أو " }, { t: "مطالبة أي أموال" }, { t: " أو أصول" }, { t: " من تركتي" }, { t: "." }],
          [{ t: "أخيرا", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "أعلن " }, { t: "أنّ " }, { t: "دولة" }, { t: " " }, { t: "جنسيتي" }, { t: " " }, { t: "ه" }, { t: "ي" }, { t: " " }, { t: "_______", b: 1 }, { t: " " }, { t: "وأنّي مقيم في دولة الإمارات العربية المتحدة" }, { t: " (إ.ع.م)" }, { t: " في وقت كتابة هذه الوصيّة" }, { t: "." }],
        ],
      },
    ],
  },
  "dubai": {
    cover: null,
    preamble: {
      en: [
        [{ t: "I, " }, { t: "________", b: 1 }, { t: ",", b: 1 }, { t: " ______ ", b: 1 }, { t: "National, born on " }, { t: "______", b: 1 }, { t: ", holder of Passport No: " }, { t: "______,", b: 1 }, { t: " " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " _______, ", b: 1 }, { t: "residing at __________" }, { t: "," }, { t: " UNITED ARAB EMIRATES" }, { t: "," }, { t: " in order to settle the succession of my estate upon my death do provide as follows, namely:" }],
      ],
      ar: [
        [{ t: "أنا" }, { t: "،" }, { t: " ", b: 1 }, { t: "________", b: 1 }, { t: "، " }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "الجنسية،" }, { t: " " }, { t: "المولود " }, { t: "في " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "حامل" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "، ", b: 1 }, { t: "وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحد" }, { t: "ة (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "مقيم" }, { t: " " }, { t: "في" }, { t: " ", b: 1 }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "الإمارات العربية المتحدة", b: 1 }, { t: "، ", b: 1 }, { t: "أكتب هذه الوصية من أجل " }, { t: "تسوية" }, { t: " وراثة ممتلكاتي " }, { t: "بعد وفاتي، وذلك" }, { t: " حسب الشروط والأحكام التالية" }, { t: "،" }, { t: " تحديداً:" }],
      ],
    },
    court: null,
    sections: [
      {
        en: [
          [{ t: "ONE:", b: 1 }, { t: " " }, { t: "Declaration and Revocation", b: 1, u: 1 }],
          [{ t: "Being of sound and disposing mind and memory and over the age of eighteen (18) years and not being actuated by any duress, menace, fraud, mistake, or undue influence, do make, publish, and declare that this Will including the revocation provision hereinafter contained is made for the purpose only of settling the succession of my estate situated or arising in " }, { t: "the " }, { t: "UNITED ARAB EMIRATES", b: 1 }, { t: " (" }, { t: "Abu Dhabi, Ajman, Fujairah, Sharjah, Dubai, Ras Al Khaimah and Umm Al Quwain) " }, { t: "only" }, { t: ". I hereby revoke and cancel all prior Wills and Testamentary writings made or granted by me, to the extent that they relate to any part of my estate in " }, { t: "the " }, { t: "UNITED ARAB EMIRATES (", b: 1 }, { t: "Abu Dhabi, Ajman, Fujairah, Sharjah, Dubai, Ras Al Khaimah and Umm Al Quwain) " }, { t: "only" }, { t: ". Further, this Will shall not affect or revoke any other Wills or testamentary dispositions I have made now or in the future, relating to my estate outside the United Arab Emirates and shall operate independently and concurrently with any such wills or testamentary disposition" }, { t: "." }],
        ],
        ar: [
          [{ t: "أولاً: ", b: 1 }, { t: "إعلان", b: 1, u: 1 }, { t: " وإلغاء", b: 1, u: 1 }],
          [{ t: "أكتب وصيتي هذه بمحض إرادتي وأنا بكامل قواي العقلية وبذاكرة سليمة، وفي سن تعد" }, { t: "ت" }, { t: " ال" }, { t: "ثامن" }, { t: " عشر " }, { t: "(18)" }, { t: " " }, { t: "عاما" }, { t: "، ومن دون أن أتعرض لأي نوع من الإكراه أو التهديد أو التأثير غير المشروع أو أن يكون لدي رغبة في الاحتيال أو بارتكاب أي خطأ، أقر وأعلن أن وصيتي هذه التي تتضمن بند الإلغاء فيما يلي هي لغرض تسوية وراثة تركتي الموجودة" }, { t: " او الناشئة" }, { t: " في" }, { t: " " }, { t: "دولة " }, { t: "الإمارات العربية المتحدة", b: 1 }, { t: " " }, { t: "(أبو ظبي وعجمان والفجيرة والشارقة ودبي ورأس الخيمة وأمّ القيوين) " }, { t: "فقط. وبموجبها ألغي بشكل صريح كل الوصايا والملحقات الإيصائية التي كتبتها أو منحتها من قبل فيما يتعلق بأي جزء من تركتي في" }, { t: " " }, { t: "دولة " }, { t: "الإمارات العربية المتحدة ", b: 1 }, { t: "(أبو ظبي وعجمان والفجيرة والشارقة ودبي ورأس الخيمة وأمّ القيوين) " }, { t: "فقط." }, { t: " و" }, { t: "علاوة علي ذلك، لن تؤثر هذه الوصية أو تلغي أيا من الوصايا أو تصرفات إيصائية أخري، التي كتبتها الآن أو في المستقبل، فيما يتعلق بممتلكاتي خارج دولة الإمارات العربية المتحدة، وينبغي أن تعمل بشكل مستقل ومتزامن مع أي من تلك الوصايا أو التصرفات الإيصائية" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "TWO:", b: 1 }, { t: "  " }, { t: "Appointment of Executors and Trustees", b: 1, u: 1 }],
          [{ t: "I appoint my " }, { t: "______", b: 1 }, { t: " " }, { t: "_____,", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: " National, born on " }, { t: "______", b: 1 }, { t: ", holder of Passport No: " }, { t: "______", b: 1 }, { t: ", " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: "__________, ", b: 1 }, { t: "to be my executrix and trustee, but if she is unable or unwilling to act or if she dies before proving my Will, the following provision shall apply instead." }],
          [{ t: "I appoint" }, { t: " ", b: 1 }, { t: "my " }, { t: "______", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: ", ", b: 1 }, { t: "______", b: 1 }, { t: " National, " }, { t: "born on " }, { t: "______", b: 1 }, { t: ", " }, { t: "holder of Passport No: " }, { t: "______", b: 1 }, { t: ", " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: "__________, ", b: 1 }, { t: "to act as my substitute executrix and trustee." }],
          [{ t: "If all my above appointed executors and trustees are unable or unwilling to act or if they shall die before proving my Will, I revoke their appointments and I make the following further appointment instead." }],
          [{ t: "I appoint as my Executors the company known as JW Legal Consultants LLC, Abu Dhabi, United Arab Emirates or the limited company, incorporated practice or firm that, at the time of my death, has succeeded to and continues to carry on its practice" }, { t: "." }, { t: " " }, { t: "(OPTIONAL)" }],
          [{ t: "Any executors or trustees acting under my Will are referred to as \"my trustees\"." }],
        ],
        ar: [
          [{ t: "ثانياً: ", b: 1 }, { t: "تعيين المنفذين والأوصياء", b: 1, u: 1 }],
          [{ t: "أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "، " }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "الجنسية،" }, { t: " " }, { t: "المولود" }, { t: "ة" }, { t: " " }, { t: "في" }, { t: "________", b: 1 }, { t: "، " }, { t: "حامل" }, { t: "ة" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "، ", b: 1 }, { t: "وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحد" }, { t: "ة (إ.ع" }, { t: ".", b: 1 }, { t: "م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " ", b: 1 }, { t: "ل" }, { t: "ت" }, { t: "كون المنفّذ" }, { t: "ة والوصية" }, { t: " " }, { t: "ع" }, { t: "ل" }, { t: "ى " }, { t: "وصيتي" }, { t: "،" }, { t: " ولكنه" }, { t: "ا" }, { t: " إذا كان" }, { t: "ت" }, { t: " غير قادر" }, { t: "ة" }, { t: " على ذلك أو غير راغب" }, { t: "ة" }, { t: " فيه" }, { t: " أو إذا مات" }, { t: "ت" }, { t: " قبل تنفيذ وصيتي،" }, { t: " " }, { t: "يُ" }, { t: "طبّق البند التالي بدلاً من ذلك" }, { t: "." }],
          [{ t: "أعيّن" }, { t: " " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "________", b: 1 }, { t: " ", b: 1 }, { t: "الجنسية،" }, { t: " " }, { t: "المولود" }, { t: "ة" }, { t: " " }, { t: "في " }, { t: "________", b: 1 }, { t: "،" }, { t: " " }, { t: "حامل" }, { t: "ة" }, { t: " جواز" }, { t: " سفر " }, { t: "رقم" }, { t: ":" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " ", b: 1 }, { t: "وبطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحد" }, { t: "ة (إ.ع" }, { t: ".", b: 1 }, { t: "م)" }, { t: " رقم:" }, { t: " " }, { t: "________", b: 1 }, { t: "،", b: 1 }, { t: " ", b: 1 }, { t: "ل" }, { t: "ت" }, { t: "كون المنفّذ" }, { t: "ة والوصية على " }, { t: "وصيتي" }, { t: "." }],
          [{ t: "إذا كان جميع " }, { t: "منفذ" }, { t: "يّ" }, { t: " وأوصيائي" }, { t: " " }, { t: "المعينين أعلاه غير قادرين على التصرف أو" }, { t: " " }, { t: "غير راغبين فيه أو" }, { t: " " }, { t: "إذا توفوا قبل تنفيذ وصيتي، فإنني ألغي" }, { t: " " }, { t: "تعييناتهم وأجري التعيين التالي بدلاً من ذلك." }],
          [{ t: "أعيّن، كمنفذيّ، الشركة المعروفة باسم" }, { t: " " }, { t: "   " }, { t: "جي دبليو للاستشارات القانونية ذ.م.م، أبو ظبي، الإمارات العربية المتحدة أو الشركة المحدودة أو المكتب المهني" }, { t: " المدمج أو المؤسسة التي تكون قد" }, { t: " " }, { t: "خلفتها قانونًا وتواصل مزاولة نشاطها المهني في وقت وفاتي" }, { t: "." }, { t: " " }, { t: "(اختياري)" }],
          [{ t: "أي منفذين" }, { t: " أو أوصياء" }, { t: " يعملون وفقاً لوصيتي يُشار إليهم باسم \"" }, { t: " أوصيائي" }, { t: "\"" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "THREE: ", b: 1 }, { t: "Debts and Funeral Expenses", b: 1, u: 1 }],
          [{ t: "I direct my trustee(s) to make payment of any of my lawful debts and/or funeral expenses and any expenses for the winding up my estate." }],
        ],
        ar: [
          [{ t: "ثالثاً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "الديون ونفقات الجنازة", b: 1, u: 1 }],
          [{ t: "أوجه" }, { t: " وصيي (أوصيائي)" }, { t: " بأداء" }, { t: " أي من" }, { t: " ديوني القانونية و" }, { t: "/أو " }, { t: "نفقات " }, { t: "الجنازة " }, { t: "و" }, { t: "أي " }, { t: "نفقات " }, { t: "ل" }, { t: "تصفية" }, { t: " " }, { t: "تركتي" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "FOUR", b: 1 }, { t: ":" }, { t: "  " }, { t: "Letter of Wishes", b: 1, u: 1 }],
          [{ t: "I direct my trustees to give effect to any writings granted by me, however informal they may be provided they are signed by me, dated after the date hereof and are clearly expressive of my intention, as to which my trustees shall be the sole judges. Any bequests so made shall be free of interest, delivery expenses and government taxes unless otherwise stipulated." }],
        ],
        ar: [
          [{ t: "رابعاً:", b: 1 }, { t: " ", b: 1 }, { t: " خطاب", b: 1, u: 1 }, { t: " الرغبات", b: 1, u: 1 }],
          [{ t: "أوجه " }, { t: "أوصيائي" }, { t: " " }, { t: "بتنفيذ أي تفويضات منحتُها مهما كانت غير رسمية، على أن تكون موقعة من طرفي، وتحمل تاريخا لاحقا لتاريخ هذه الوصية وتفصح بجلاء عن نيتي والتي سيكون " }, { t: "أوصيائي" }, { t: " " }, { t: "هم الوحيدون المخول لهم الحكم بشأنها. أي هبات إيصائية يتم إعدادها بهذه الكيفية ستكون معفاة من الفوائد ونفقات التسليم والضرائب الحكومية، ما لم ينص على خلاف ذلك" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "FIVE", b: 1 }, { t: ":" }, { t: "  " }, { t: "Jurisdiction", b: 1, u: 1 }],
          [{ t: "It is expressly stipulated that this Will is in accordance with the United Arab Emirates Article 17 of the Law of Civil Transactions promulgated by Federal Law No 5/1985, and the amendments thereto and the substantive provisions governing testamentary disposition and other dispositions taking effect after my death shall be governed in accordance with the provisions of this Will. Shariah Law shall not apply in any circumstances." }],
        ],
        ar: [
          [{ t: "خامساً", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "الإختصاص القضائي", b: 1, u: 1 }],
          [{ t: "هناك نص صريح على أن هذه الوصية تأتي متوافقة مع المادة " }, { t: "17 " }, { t: "من قانون المعاملات المدنية في الإمارات العربية المتحدة المنشور بالقانون الاتحادي رقم " }, { t: "5/1985" }, { t: "،" }, { t: " " }, { t: "وتعديلاته،" }, { t: " " }, { t: "والأحكام الموضوعية التي تحكم التصرفات الإيصائية والتصرفات الأخرى التي قد تصبح نافذة بعد وفاتي ستخضع لبنود هذه الوصية" }, { t: "." }, { t: " ولا تطبق قوانين الشريعة بأي حال من الأحوال" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "SIX", b: 1 }, { t: ": ", b: 1 }, { t: "Religion & Faith", b: 1, u: 1 }],
          [{ t: "I confirm that I am Non/Muslim and I am _" }, { t: "_____ ", b: 1 }, { t: "by" }, { t: " Faith" }, { t: "." }],
        ],
        ar: [
          [{ t: "سادساً", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1, u: 1 }, { t: "الدين والعقيدة", b: 1, u: 1 }],
          [{ t: "أؤكد أنني" }, { t: " غير مسلم" }, { t: "/مسلم" }, { t: " ومن أتباع العقيدة " }, { t: "_" }, { t: "_____", b: 1 }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "SEVEN", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "Entitlements of Insurance Proceeds", b: 1, u: 1 }],
          [{ t: "I direct my trustees that all proceeds from any insurance policies shall be distributed according to the existing nomination/beneficiary form filled up by me and in the absence of such form, the following beneficiary provisions of this Will shall apply instead" }, { t: "." }],
        ],
        ar: [
          [{ t: "سابعاً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "مستحقات إيرادات التأمين", b: 1, u: 1 }],
          [{ t: "أوجّه " }, { t: "أوصيائ" }, { t: "ي" }, { t: " بأن يتم توزيع جميع الإيرادات المتأتية من أيّ بوالص تأمين وفق نموذج الترشيح/ الانتفاع الحالي الذي تم تعبئته من قبلي وفي حال عدم وجود هذا النموذج" }, { t: "،" }, { t: " " }, { t: "ي" }, { t: "نطبق " }, { t: "بنود الإنتفاع التالية" }, { t: " من هذه الوصية بدلاً من ذلك" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "EIGHT", b: 1 }, { t: ": ", b: 1 }, { t: "Distribution of My Estate", b: 1, u: 1 }],
          [{ t: "I direct my trustees to make over the whole remainder of my means and estate, moveable " }, { t: "and non-moveable properties, all financial assets" }, { t: " " }, { t: "including but not limited to bank accounts, including savings, current and fixed deposits and investment accounts any other accounts, motorcycles, motor cars, art and antiques, jewels, jewellery, furniture and fixtures, debentures, leasehold, bonds, security lockers, stocks, shares, investments, copyrights, intangible assets, inheritances, mutual funds, capital, death in service benefits, gratuity payments, reserves and any shareholding in any companies and any other assets" }, { t: " " }, { t: "to my " }, { t: "______", b: 1 }, { t: " " }, { t: "______,", b: 1 }, { t: " (100%) one-hundred percentage share " }, { t: "absolutely." }],
        ],
        ar: [
          [{ t: "ثامناً", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "توزيع تركتي", b: 1, u: 1 }],
          [{ t: "أوجّه " }, { t: "أوصيائي" }, { t: " بأن يحوّلوا كل الباقي من أموالي " }, { t: "وتركتي" }, { t: "، " }, { t: "الممتلكات " }, { t: "المنقولة وغير المنقولة وكافة " }, { t: "الأصول المالية " }, { t: "بما في ذلك على سبيل المثال لا الحصر الحسابات المصرفية" }, { t: "،" }, { t: " " }, { t: "بما في ذلك حسابات التوفير والودائع الجارية والثابتة" }, { t: " وحسابات الإستثمار" }, { t: " وأيّ حسابات أخرى والدراجات النارية والسيارات والقطع الفنية والأثرية" }, { t: " " }, { t: "والحلي" }, { t: " " }, { t: "والمجوهرات" }, { t: " " }, { t: "والأثاث والتجهيزات وسندات الدين " }, { t: "والحقوق الايجارية" }, { t: " والصكوك" }, { t: " " }, { t: "وخزائن الإيداع الآمن والسندات والأسهم والاستثمارات " }, { t: "و" }, { t: "حقوق الطبع والنشر والأصول غير الملموسة" }, { t: " " }, { t: "والتركات" }, { t: " وصناديق الإستثمار و" }, { t: "رؤ" }, { t: "و" }, { t: "س الأموال وتعويضات الوفاة على رأس العمل ومكافآت نهاية الخدمة والمدخرات وأيّ حصص في أيّ شركات وأيّ أصول أخرى" }, { t: " " }, { t: "إلى " }, { t: "______", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: "،" }, { t: " " }, { t: "بنسبة " }, { t: "(" }, { t: "100%" }, { t: ")" }, { t: " " }, { t: "مائة " }, { t: "بالمائة من الحصص  " }, { t: "بشكل مطلق" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "NINE", b: 1 }, { t: ": ", b: 1 }, { t: "If " }, { t: "my " }, { t: "______", b: 1 }, { t: " " }, { t: "_______", b: 1 }, { t: " does not survive me, but in such event only, I direct my trustees to make over the whole remainder of my means and estate in the following manner" }, { t: ":" }],
          [{ t: "As to (50%) fifty percentage shares of my estate to my" }, { t: " " }, { t: "______", b: 1 }, { t: " " }, { t: "_______,", b: 1 }, { t: " absolutely and in the event of " }, { t: "her/him", b: 1 }, { t: " not surviving me or failing to take a vested interest then to " }, { t: "her/his", b: 1 }, { t: " children" }, { t: " " }, { t: "as shall survive me to share equally among them if more than one. " }, { t: "– optional" }],
          [{ t: "As to (50%) fifty percentage shares of my estate to my" }, { t: " " }, { t: "______", b: 1 }, { t: " " }, { t: "______,", b: 1 }, { t: " absolutely and in the event of " }, { t: "her/him", b: 1 }, { t: " not surviving me or failing to take a vested interest then to " }, { t: "her/his", b: 1 }, { t: " children" }, { t: " " }, { t: "as shall survive me to share equally among them if more than one. " }, { t: "– optional" }],
          [{ t: "If any part of my estate falls to a beneficiary who has not attained the age of (18) eighteen years, my trustees shall hold the same in trust for this beneficiary until the age of (18) eighteen years is attained." }],
          [{ t: "Income arising from such share shall be accumulated by my trustees who may apply all or part of the income or capital of this share for the maintenance, education or benefit of this beneficiary." }],
          [{ t: "In the event of any of the foregoing shares of the residue remain undisposed of by the preceding provisions, such share shall be distributed to the other " }, { t: "beneficiaries" }, { t: " pro rata according to their shares" }, { t: "." }],
        ],
        ar: [
          [{ t: "تاسعاً", b: 1 }, { t: ": ", b: 1 }, { t: "إذا لم " }, { t: "ي" }, { t: "عش " }, { t: "______", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: " " }, { t: "من" }, { t: " " }, { t: "بعدي" }, { t: "،" }, { t: " " }, { t: "ولكن في" }, { t: " " }, { t: "هذه الحالة فقط" }, { t: "، ", b: 1 }, { t: "فإني" }, { t: " " }, { t: "أوجّه " }, { t: "أوصيائي" }, { t: " بأن يحولوا كل الباقي من أموالي" }, { t: " " }, { t: "وممتلكاتي" }, { t: " " }, { t: "على النحو التالي" }, { t: ":" }],
          [{ t: "نسبة" }, { t: " " }, { t: "(" }, { t: "50" }, { t: "%)" }, { t: " " }, { t: "خمسين" }, { t: " " }, { t: "بالمائة" }, { t: " " }, { t: "من " }, { t: "حصص تركتي" }, { t: " إلى " }, { t: "______", b: 1 }, { t: " " }, { t: "_______", b: 1 }, { t: "،" }, { t: " " }, { t: "بشكل مطلق" }, { t: " " }, { t: "وفي حال " }, { t: "لم " }, { t: "ت", b: 1 }, { t: "عش", b: 1 }, { t: "/ي", b: 1 }, { t: "عش", b: 1 }, { t: " من بعدي أو تعذر حصوله" }, { t: " على" }, { t: " " }, { t: "حصة مكتسبة، فعندئذ إلى " }, { t: "أبنائه", b: 1 }, { t: "ا/", b: 1 }, { t: "أبنائه", b: 1 }, { t: " " }, { t: "إذا عاشوا" }, { t: " " }, { t: "من بعدي تقسم بينهم بأنصبة" }, { t: " " }, { t: "متساوية، إذا زاد" }, { t: " " }, { t: "عددهم عن واحد" }, { t: "." }, { t: " - " }, { t: "اختياري" }],
          [{ t: "نسبة " }, { t: "(" }, { t: "50" }, { t: "%)" }, { t: " " }, { t: "خمسين" }, { t: " بالمائة" }, { t: " " }, { t: "من حصص تركتي إلى " }, { t: "______", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: " " }, { t: "بشكل مطلق" }, { t: " وفي حال " }, { t: "لم " }, { t: "ت", b: 1 }, { t: "عش", b: 1 }, { t: "/ي", b: 1 }, { t: "عش", b: 1 }, { t: " من بعدي أو تعذر حصوله على" }, { t: " " }, { t: "حصة مكتسبة، فعندئذ إلى " }, { t: "أبنائه", b: 1 }, { t: "ا/", b: 1 }, { t: "أبنائه", b: 1 }, { t: " " }, { t: "إذا عاشوا" }, { t: " " }, { t: "من بعدي تقسم بينهم بأنصبة" }, { t: " " }, { t: "متساوية، إذا زاد" }, { t: " " }, { t: "عددهم عن واحد" }, { t: "." }, { t: " - " }, { t: "اختياري" }],
          [{ t: "إ" }, { t: "ذا آل أي جزء من" }, { t: " " }, { t: "ممتلكاتي إلى منتفع لم يبلغ" }, { t: " سن ال" }, { t: "ثامن عشر " }, { t: "(18)" }, { t: " " }, { t: "عاما" }, { t: "،" }, { t: " " }, { t: "فسوف " }, { t: "يحتفظ أوصيائي بذلك الجزء كأمانة لصالح ذلك المستفيد " }, { t: "حتى يبلغ" }, { t: " " }, { t: "سن " }, { t: "الثامن عشر " }, { t: "(18)" }, { t: "." }],
          [{ t: "يحتفظ أوصيائي بالدخل الناشئ عن هذه الحصة " }, { t: "و" }, { t: "يجوز" }, { t: " لهم" }, { t: " استخدام كل أو بعض من دخل" }, { t: " هذه الحصة" }, { t: " " }, { t: "أو رأسمالها " }, { t: "من أجل إعالة" }, { t: " ذلك " }, { t: "المنتف" }, { t: "ع" }, { t: " " }, { t: "أو " }, { t: "تعليمه " }, { t: "أو " }, { t: "تحقيق مصالحه" }, { t: "." }],
          [{ t: "في " }, { t: "حال بقاء أي من الحصص المذكورة أعلاه من الباقي بدون توزيع بموجب البنود السابقة" }, { t: "، يتم توزيع تلك الحصص إلى" }, { t: " المنتفعين" }, { t: " الآخرين " }, { t: "تناسبياً وفقاً لحصة كل منه" }, { t: "م." }],
        ],
      },
      {
        en: [
          [{ t: "TEN: ", b: 1 }, { t: "In the event of no person or persons above referred to taking a vested interest in my estate, I direct my trustees to make over the whole remainder of my means and estate " }, { t: "to _________, absolutely. " }, { t: "(OPTIONAL)" }],
        ],
        ar: [
          [{ t: "عاشرا:", b: 1 }, { t: " " }, { t: "في حال" }, { t: " لم يحصل أي شخص أو أشخاص" }, { t: " " }, { t: "من " }, { t: "المذكورين" }, { t: " " }, { t: "أعلاه" }, { t: " على حصة مكتسبة " }, { t: "في تركتي" }, { t: "،", b: 1 }, { t: " " }, { t: "أوجّه " }, { t: "أوصيائي" }, { t: " بأن يحولوا كل الباقي من" }, { t: " أموالي وممتلكاتي" }, { t: " " }, { t: "إلى " }, { t: "_________" }, { t: " " }, { t: "بشكل مطلق" }, { t: ". " }, { t: "(اختياري)" }],
        ],
      },
      {
        en: [
          [{ t: "ELEVEN", b: 1 }, { t: ":", b: 1 }, { t: " ", b: 1 }, { t: "If any part of my estate is held for a beneficiary who lacks full legal capacity, my trustees shall have following powers: -" }],
          [{ t: "To pay or apply any part of the income or capital falling to that beneficiary for his or her benefit in any manner my trustees think proper." }],
          [{ t: "To retain the same until such capacity is attained, accumulating income with capital, " }, { t: " " }, { t: "or" }],
          [{ t: "To pay over the same to the legal guardian or the person for the time being having the " }, { t: "custody of that beneficiary, whose receipt shall be a sufficient discharge to my trustees." }],
        ],
        ar: [
          [{ t: "حادي عشر", b: 1 }, { t: ": ", b: 1 }, { t: "إذا احتفظ أوصيائي بأي جزء من تركتي لصالح منتفع يفتقر للأهلية القانونية الكاملة، فسيكون لأوصيائي " }, { t: "ال" }, { t: "صلاحي" }, { t: "ات التالية:" }],
          [{ t: "أداء أو استخدام أي جزء من الإيراد " }, { t: "أو رأسمالها " }, { t: "الآيل لذلك المنتفع لما فيه مصلحته أو مصلحتها بالطريقة التي يراها أوصيائي مناسبة" }, { t: "." }],
          [{ t: "الإبقاء على ذلك الجزء إلى حين بلوغه الأهلية المطلوبة مع إضافة الإيراد إلى رأس المال، أو" }],
          [{ t: "أداء الجزء المذكور إلى الوصي الشرعي أو الشخص الذي له حق الوصاية على ذلك " }, { t: "المنتفع في تلك المرحلة، وسيكون في الإيصال الصادر عن أي منهما إبراء كافياً لذمة أوصيائي" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "TWELVE", b: 1 }, { t: ":", b: 1 }],
          [{ t: "My trustees shall have the fullest powers of retention, realisation, investment, transfer of property without consideration, and management of my estate as if they were absolute owners and not trustees. However, all proceeds are for the beneficiaries only." }],
          [{ t: "My trustees may appoint one or more executor of their own number to act as solicitor or agent in any other capacity and allow that trustee the same remuneration, as to which that trustee would have been entitled to." }],
        ],
        ar: [
          [{ t: "ثاني", b: 1 }, { t: " عشر", b: 1 }, { t: ":", b: 1 }],
          [{ t: "يكون " }, { t: "لأوصيائي الصلاحية المطلقة للاحتفاظ " }, { t: "بالممتلكات " }, { t: "وتسييلها" }, { t: " " }, { t: "وإ" }, { t: "ستثمارها وتحويل" }, { t: "ها" }, { t: " دون " }, { t: "مقابل" }, { t: " وإدار" }, { t: "ة تركتي" }, { t: " كما لو كانوا يملكونها فعلا وليسوا " }, { t: "أوصياء" }, { t: ". ولكن تكون جميع الإيرادات لصالح المنتفعين فقط" }, { t: "." }],
          [{ t: "يمكن لأوصيائي تعيين " }, { t: "منفذ " }, { t: "واحد منهم أو أكثر ليكون محامياً أو وكيلاً بأي صفة أخرى وتخصيص نفس الراتب لذلك " }, { t: "الوصي" }, { t: " الذي كان يحق له أن يحصل عليه" }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "T", b: 1 }, { t: "HIRTEEN", b: 1 }, { t: ": ", b: 1 }, { t: "Guardianship Appointments", b: 1, u: 1 }],
          [{ t: "Upon my demise, I appoint my " }, { t: "______, ________,", b: 1 }, { t: " to act as permanent guardian " }, { t: "of my children as follows:" }],
          [{ t: "My child __________." }],
          [{ t: "My child __________." }],
          [{ t: "In the event of " }, { t: "her/him", b: 1 }, { t: " predeceasing me or being unable or unwilling to act, I appoint __________, to act as permanent guardian of my children if they are under the age of full capacity at the time of my death." }],
          [{ t: "However, if the appointed permanent guardians above-mentioned are unable to act and take the custody of my children, for the interim period only, I appoint " }, { t: "__________,", b: 1 }, { t: " " }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: " " }, { t: "________,", b: 1 }, { t: " " }, { t: "to act as interim guardian of my " }, { t: "children" }, { t: " " }, { t: "and in the event of " }, { t: "her/him", b: 1 }, { t: " predeceasing me or being unable or unwilling to act, I appoint " }, { t: "__________, ", b: 1 }, { t: "with United Arab Emirates (UAE) Resident Identity Card No." }, { t: "_________,", b: 1 }, { t: " ", b: 1 }, { t: "to act as interim guardian of my children if they are under the age of full capacity at the time of my death." }],
          [{ t: "This interim guardianship appointment will apply until the permanent guardians will be able to act and take over the custody of my children." }],
        ],
        ar: [
          [{ t: "ثا", b: 1 }, { t: "لث", b: 1 }, { t: " عشر", b: 1 }, { t: ":  ", b: 1 }, { t: "تعيينات الوصاية", b: 1, u: 1 }],
          [{ t: "في وقت وفاتي" }, { t: "،" }, { t: " فإني" }, { t: " أعيّن" }, { t: " " }, { t: "______", b: 1 }, { t: "،", b: 1 }, { t: "______", b: 1 }, { t: "،" }, { t: " ", b: 1 }, { t: "ل" }, { t: "ي" }, { t: "كون " }, { t: "الوصي" }, { t: "ّ " }, { t: "الدائم" }, { t: " " }, { t: "على" }, { t: " " }, { t: "أولاد", b: 1 }, { t: "ي", b: 1 }, { t: " " }, { t: "كما يلي:" }],
          [{ t: "إبني ", b: 1 }, { t: "______", b: 1 }, { t: "." }],
          [{ t: "إ" }, { t: "بني " }, { t: "______", b: 1 }, { t: "." }],
          [{ t: "وف" }, { t: "ي حال" }, { t: " " }, { t: "توفي", b: 1 }, { t: "ت/توفي", b: 1 }, { t: " قبلي أو" }, { t: " كان غير قادر" }, { t: " على التصرف" }, { t: " " }, { t: "أو" }, { t: " غير " }, { t: "راغب" }, { t: " فيه" }, { t: "، " }, { t: "أعيّن" }, { t: " ", b: 1 }, { t: "______", b: 1 }, { t: "،", b: 1 }, { t: " " }, { t: "ل" }, { t: "ي" }, { t: "كون الوصي" }, { t: "ّ" }, { t: " " }, { t: "الدائم " }, { t: "على " }, { t: "أولادي", b: 1 }, { t: "،", b: 1 }, { t: " " }, { t: "إذا كان" }, { t: "وا" }, { t: " " }, { t: "تحت سن الأهلية الكاملة " }, { t: "عند" }, { t: " وفاتي" }, { t: "." }],
          [{ t: "ولكن" }, { t: "، إذا كان" }, { t: " " }, { t: "ال" }, { t: "أوصياء" }, { t: " الدائم" }, { t: "ون" }, { t: " المعين" }, { t: "ون" }, { t: " المذكور" }, { t: "ون" }, { t: " أعلاه غير قادر" }, { t: "ين" }, { t: " على التصرف وتولي حضانة " }, { t: "أولادي", b: 1 }, { t: "، للفترة " }, { t: "الإنتقالية" }, { t: " " }, { t: "فقط،" }, { t: " " }, { t: "أعين" }, { t: " " }, { t: "______", b: 1 }, { t: "، ", b: 1 }, { t: "حامل ", b: 1 }, { t: "بطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحد" }, { t: "ة (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "______", b: 1 }, { t: "، " }, { t: "ل" }, { t: "ي" }, { t: "كون الوصي المؤقت" }, { t: " ", b: 1 }, { t: "على " }, { t: "أولادي", b: 1 }, { t: " " }, { t: "وف" }, { t: "ي حال" }, { t: " " }, { t: "توفيت", b: 1 }, { t: "/توفي", b: 1 }, { t: " قبلي أو" }, { t: " كان غير قادر" }, { t: " على التصرف أو" }, { t: " غير " }, { t: "راغب فيه" }, { t: "، " }, { t: "أعيّن" }, { t: " ", b: 1 }, { t: "______", b: 1 }, { t: "، ", b: 1 }, { t: "حامل ", b: 1 }, { t: "بطاقة", b: 1 }, { t: " هوية " }, { t: "مقيم " }, { t: "دولة الإمارات العربية المتحد" }, { t: "ة (إ.ع.م)" }, { t: " رقم:" }, { t: " " }, { t: "______", b: 1 }, { t: "، " }, { t: "ل" }, { t: "ي" }, { t: "كون الوصي المؤقت" }, { t: " ", b: 1 }, { t: "على " }, { t: "أولادي", b: 1 }, { t: "،", b: 1 }, { t: " " }, { t: "إذا كان" }, { t: "وا" }, { t: " " }, { t: "تحت سن الأهلية الكاملة " }, { t: "عند" }, { t: " وفاتي" }, { t: "." }],
          [{ t: "و" }, { t: "ي" }, { t: "سري" }, { t: " هذا" }, { t: " التعيي" }, { t: "ن" }, { t: " للوص" }, { t: "ا" }, { t: "ية المؤقتة " }, { t: "إل" }, { t: "ى" }, { t: " أن يصبح " }, { t: "الاوصياء الدائمون " }, { t: "قادرين على التصرف وتولي" }, { t: " " }, { t: " " }, { t: "حضانة" }, { t: " " }, { t: "أولادي", b: 1 }, { t: "." }],
        ],
      },
      {
        en: [
          [{ t: "FOURTEEN: ", b: 1 }, { t: "I " }, { t: "hereby declare that, in the event of a divorce, my " }, { t: "______", b: 1 }, { t: ", " }, { t: "_______", b: 1 }, { t: ", shall not be entitled to receive or claim any funds or assets from my estate" }, { t: ". " }, { t: "(OPTIONAL)" }],
          [{ t: "Declaration clause", b: 1, u: 1 }],
          [{ t: "I " }, { t: "hereby declare that, I have made no provision for my " }, { t: "Ex-", b: 1 }, { t: " " }, { t: "______", b: 1 }, { t: " in my Will " }, { t: "and he" }, { t: " ", b: 1 }, { t: "shall not be entitled to receive or claim any funds or assets from my estate" }, { t: ".  " }, { t: "(OPTIONAL)" }],
          [{ t: "FINALLY", b: 1 }, { t: ": ", b: 1 }, { t: "I declare that my country of citizenship is the " }, { t: "_______", b: 1 }, { t: " " }, { t: "and I am residing in the United Arab Emirates at the time of writing this Will." }],
        ],
        ar: [
          [{ t: "رابع عشر", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "أ" }, { t: "علن" }, { t: " " }, { t: "بموجب هذا أنه في حالة طلاق" }, { t: "، " }, { t: "ل" }, { t: "ا" }, { t: " " }, { t: "يكون" }, { t: " " }, { t: "_______", b: 1 }, { t: " مستحقا" }, { t: " لتلقي" }, { t: " أو " }, { t: "مطالبة أي أموال" }, { t: " أو أصول" }, { t: " من تركتي" }, { t: "." }, { t: " " }, { t: "(اختياري)" }],
          [{ t: "بند الإعلان", b: 1, u: 1 }],
          [{ t: "أ" }, { t: "علن" }, { t: " " }, { t: "بموجب هذا أنه" }, { t: " لم أقم بأي تخصيص لصالح " }, { t: "_______", b: 1 }, { t: " " }, { t: "السابق " }, { t: "في " }, { t: "وصيتي و" }, { t: "ل" }, { t: "ا" }, { t: " " }, { t: "يكون مستحقا" }, { t: " لتلقي" }, { t: " أو " }, { t: "مطالبة أي أموال" }, { t: " أو أصول" }, { t: " من تركتي" }, { t: "." }, { t: " " }, { t: "(اختياري)" }],
          [{ t: "أخيرا", b: 1 }, { t: ":", b: 1 }, { t: " " }, { t: "أعلن " }, { t: "أنّ " }, { t: "دولة" }, { t: " " }, { t: "جنسيتي" }, { t: " " }, { t: "هي" }, { t: " " }, { t: "_______", b: 1 }, { t: " " }, { t: "وأنّي مقيم في دولة الإمارات العربية المتحدة" }, { t: " في وقت كتابة هذه الوصيّة" }, { t: "." }],
        ],
      },
    ],
  },
};
