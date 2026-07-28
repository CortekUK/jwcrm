import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";
import type { Answers, WillJurisdiction } from "@/types/will-form";

/**
 * In-code Last Will & Testament generator.
 *
 * Reproduces the JW Legal Consultants will templates (Abu Dhabi / Dubai) and
 * fills the clause blanks from the client's `answers`. Anything the form does
 * not capture (nationality, DOB, EID for some persons, child names) is rendered
 * as an underscore blank for the drafter to complete during review.
 *
 * Note: the Abu Dhabi Arabic cover page and full side-by-side bilingual body
 * are handled separately (see the bilingual translation backlog item). This
 * generator produces the English legal body for both jurisdictions.
 */

export type WillPdfInput = {
  answers: Answers;
  jurisdiction: WillJurisdiction;
  clientName: string;
  draft?: boolean; // add a DRAFT watermark
  /**
   * Base64 PNG data URL of the testator's signature on the FINALISED will
   * (wills.client_signature). When present it is drawn onto the execution
   * block instead of a blank ruled line. Absent for drafts, which are
   * produced before the client has signed anything.
   */
  signature?: string | null;
  signatureDate?: string | null;
};

const BLANK = "____________";

const val = (v: unknown, fallback = BLANK): string => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : fallback;
};

type PersonLike = {
  name?: string;
  relation?: string;
  passport_number?: string;
  emirates_id_number?: string;
};

// "my [relation] [NAME], [Nationality] National, born on ____, holder of
// Passport No: ____, with UAE Resident Identity Card No. ____"
function describePerson(p: PersonLike): string {
  const relation = val(p.relation, "");
  const name = val(p.name);
  const lead = relation ? `my ${relation} ${name}` : name;
  return (
    `${lead}, ${BLANK} National, born on ${BLANK}, holder of Passport No: ` +
    `${val(p.passport_number)}, with United Arab Emirates (UAE) Resident Identity ` +
    `Card No. ${val(p.emirates_id_number)}`
  );
}

export function generateWillPDF(input: WillPdfInput): string {
  const { answers, jurisdiction, clientName, draft, signature, signatureDate } = input;
  const isAUD = jurisdiction === "abu_dhabi";
  const cityLine = isAUD ? "Abu Dhabi, United Arab Emirates" : "Dubai, United Arab Emirates";
  const ageOfMajority = isAUD ? "twenty-one (21)" : "eighteen (18)";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 20;
  const RIGHT = pageWidth - M;
  const contentW = RIGHT - M;
  const BOTTOM = pageHeight - 20;

  let y = M;

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };

  const paragraph = (
    text: string,
    opts: { size?: number; bold?: boolean; gap?: number; indent?: number } = {}
  ) => {
    const { size = 10.5, bold = false, gap = 3, indent = 0 } = opts;
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(text, contentW - indent) as string[];
    const lineH = size * 0.42;
    for (const line of lines) {
      ensureSpace(lineH + 1);
      doc.text(line, M + indent, y);
      y += lineH;
    }
    y += gap;
  };

  const clause = (heading: string, body: string) => {
    ensureSpace(14);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(12, 85, 54);
    doc.text(heading, M, y);
    y += 5.5;
    paragraph(body, { gap: 4 });
  };

  const centered = (text: string, size: number, bold: boolean, color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    ensureSpace(size * 0.5);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    y += size * 0.5;
  };

  // ---------- Cover page ----------
  y = 60;
  centered("LAST WILL AND", 20, true, [12, 85, 54]);
  centered("TESTAMENT OF", 20, true, [12, 85, 54]);
  y += 16;
  centered(val(clientName, "Client's Full Name").toUpperCase(), 18, true);
  y += 40;
  centered(companyDetails.legalName, 13, true);
  centered(cityLine, 11, false, [90, 90, 90]);
  y += 6;
  centered(companyDetails.invoicePhone, 10, false, [90, 90, 90]);
  centered(companyDetails.invoiceEmail.toLowerCase(), 10, false, [90, 90, 90]);

  // ---------- Body ----------
  doc.addPage();
  y = M;

  const testator = answers.personal || ({} as Answers["personal"]);
  const passportNo = answers.identity?.passport_number;

  paragraph(
    `I, ${val(testator.full_name || clientName)}, ${BLANK} National, born on ${BLANK}, ` +
      `holder of Passport No: ${val(passportNo)}, with United Arab Emirates (UAE) Resident ` +
      `Identity Card No. ${BLANK}, residing at ${val(testator.address)}, UNITED ARAB EMIRATES, ` +
      `in order to settle the succession of my estate upon my death do provide as follows, namely:`,
    { gap: 5 }
  );

  // ONE — Declaration
  clause(
    isAUD ? "ONE   Declaration" : "ONE   Declaration and Revocation",
    isAUD
      ? `Being of sound mind and memory and over the age of ${ageOfMajority} years and not being ` +
          `actuated by any duress, menace, fraud, mistake, or undue influence, do make, publish, and ` +
          `declare that this Will is made for the purpose only of settling the succession of my estate ` +
          `situated or arising in the UNITED ARAB EMIRATES only. Any Wills made prior to this Will, ` +
          `relating to my estate in the UAE are now cancelled.`
      : `Being of sound and disposing mind and memory and over the age of ${ageOfMajority} years and ` +
          `not being actuated by any duress, menace, fraud, mistake, or undue influence, do make, ` +
          `publish, and declare that this Will including the revocation provision hereinafter contained ` +
          `is made for the purpose only of settling the succession of my estate situated or arising in ` +
          `the UNITED ARAB EMIRATES (Abu Dhabi, Ajman, Fujairah, Sharjah, Dubai, Ras Al Khaimah and ` +
          `Umm Al Quwain) only. I hereby revoke and cancel all prior Wills and Testamentary writings ` +
          `made or granted by me, to the extent that they relate to any part of my estate in the UNITED ` +
          `ARAB EMIRATES. Further, this Will shall not affect or revoke any other Wills or testamentary ` +
          `dispositions I have made now or in the future, relating to my estate outside the United Arab ` +
          `Emirates and shall operate independently and concurrently with any such wills.`
  );

  // TWO — Executors and Trustees
  const executors = [...(answers.executors || [])].sort((a, b) => a.level - b.level);
  const primaryExec = executors[0];
  const substituteExec = executors[1];
  const furtherExec = executors[2];
  let twoBody =
    `I appoint ${primaryExec ? describePerson(primaryExec) : `my ${BLANK}`}, to be my executor ` +
    `and trustee, but if he/she is unable or unwilling to act or if he/she dies before proving my ` +
    `Will, the following provision shall apply instead.\n\n`;
  twoBody +=
    `I appoint ${substituteExec ? describePerson(substituteExec) : `my ${BLANK}`}, to act as my ` +
    `substitute executor and trustee.\n\n`;
  if (furtherExec) {
    twoBody +=
      `If all my above appointed executors and trustees are unable or unwilling to act or if they ` +
      `shall die before proving my Will, I revoke their appointments and I appoint ` +
      `${describePerson(furtherExec)}, to act as my substitute executor and trustee.\n\n`;
  }
  twoBody +=
    `I appoint as my Executors the company known as ${companyDetails.legalName}, ${cityLine} or the ` +
    `limited company, incorporated practice or firm that, at the time of my death, has succeeded to ` +
    `and continues to carry on its practice. (OPTIONAL)\n\n` +
    `Any executors or trustees acting under my Will are referred to as "my trustees".`;
  clause("TWO   Appointment of Executors and Trustees", twoBody);

  // THREE — Debts and Funeral Expenses
  clause(
    "THREE   Debts and Funeral Expenses",
    `I direct my trustee(s) to make payment of any of my lawful debts and/or funeral expenses and ` +
      `any expenses for the winding up of my estate.`
  );

  // FOUR — Letter of Wishes
  clause(
    "FOUR   Letter of Wishes",
    `I direct my trustees to give effect to any writings granted by me, however informal they may be ` +
      `provided they are signed by me, dated after the date hereof and are clearly expressive of my ` +
      `intention, as to which my trustees shall be the sole judges. Any bequests so made shall be free ` +
      `of interest, delivery expenses and government taxes unless otherwise stipulated.`
  );

  // FIVE — Law / Jurisdiction
  clause(
    isAUD ? "FIVE   Law" : "FIVE   Jurisdiction",
    isAUD
      ? `The Law of the United Arab Emirates (UAE) applies. Sharia Law will not be applied; the wishes ` +
          `outlined in this Last Will and Testament shall be honored. The substantive provisions governing ` +
          `testamentary disposition and other dispositions taking effect after my death shall be governed ` +
          `in accordance with the provisions of this Will.`
      : `It is expressly stipulated that this Will is in accordance with the United Arab Emirates Article ` +
          `17 of the Law of Civil Transactions promulgated by Federal Law No 5/1985, and the amendments ` +
          `thereto and the substantive provisions governing testamentary disposition and other dispositions ` +
          `taking effect after my death shall be governed in accordance with the provisions of this Will. ` +
          `Shariah Law shall not apply in any circumstances.`
  );

  // SIX — Religion & Faith
  clause(
    "SIX   Religion & Faith",
    `I confirm that I am a Non/Muslim and ${val(testator.religion)} by Faith.`
  );

  // SEVEN — Insurance Proceeds
  clause(
    "SEVEN   Entitlements of Insurance Proceeds",
    `I direct my trustees that all proceeds from any insurance policies shall be distributed according ` +
      `to the existing nomination/beneficiary form filled up by me and in the absence of such form, the ` +
      `following beneficiary provisions of this Will shall apply instead.`
  );

  // EIGHT / NINE — Distribution of Estate
  const beneficiaries = [...(answers.beneficiaries || [])].sort((a, b) => a.level - b.level);
  const primaryBens = beneficiaries.filter((b) => b.level === 1);
  const contingentBens = beneficiaries.filter((b) => b.level > 1);

  const estatePreamble =
    `I direct my trustees to make over the whole remainder of my means and estate, moveable and ` +
    `non-moveable properties, all financial assets including but not limited to bank accounts, ` +
    `investments, motor vehicles, art and antiques, jewellery, furniture, bonds, stocks, shares, ` +
    `intangible assets, mutual funds, gratuity payments, and any shareholding in any companies and ` +
    `any other assets`;

  let eightBody: string;
  if (primaryBens.length > 0) {
    const parts = primaryBens.map(
      (b) => `to ${val(b.name)}${b.relationship ? ` (${b.relationship})` : ""} (${b.percentage ?? BLANK}%)`
    );
    eightBody = `${estatePreamble} ${parts.join(", and ")} absolutely.`;
  } else {
    eightBody = `${estatePreamble} to my ${BLANK} (100%) one hundred percentage share absolutely.`;
  }
  clause("EIGHT   Distribution of My Estate", eightBody);

  let nineBody =
    `If my primary beneficiary does not survive me, but in such event only, I direct my trustees to ` +
    `make over the whole remainder of my means and estate in the following manner:\n\n`;
  if (contingentBens.length > 0) {
    for (const b of contingentBens) {
      nineBody +=
        `As to (${b.percentage ?? BLANK}%) of my estate to ${val(b.name)}` +
        `${b.relationship ? ` (${b.relationship})` : ""} absolutely and in the event of her/him not ` +
        `surviving me or failing to take a vested interest then to her/his biological children as shall ` +
        `survive me to share equally among them if more than one.\n\n`;
    }
  } else {
    nineBody +=
      `As to (50%) fifty percentage shares of my estate to my ${BLANK} absolutely, and as to (50%) ` +
      `fifty percentage shares of my estate to my ${BLANK} absolutely. (optional)\n\n`;
  }
  nineBody +=
    `If any part of my estate falls to a beneficiary who has not attained the legal age of majority, ` +
    `my trustees shall hold the same in trust for this beneficiary until the legal age of majority is ` +
    `attained. Income arising from such share shall be accumulated by my trustees who may apply all or ` +
    `part of the income or capital of this share for the maintenance, education or benefit of this ` +
    `beneficiary. In the event of any of the foregoing shares of the residue remaining undisposed of, ` +
    `such share shall be distributed to the other beneficiaries pro rata according to their shares.`;
  clause("NINE   Contingent Distribution", nineBody);

  // TEN — Ultimate gift over
  clause(
    "TEN   Ultimate Provision",
    `In the event of no person or persons above referred to taking a vested interest in my estate, I ` +
      `direct my trustees to make over the whole remainder of my means and estate to ${BLANK}, ` +
      `absolutely. (OPTIONAL)`
  );

  // ELEVEN — Beneficiary lacking capacity
  clause(
    "ELEVEN   Beneficiaries Lacking Capacity",
    `If any part of my estate is held for a beneficiary who lacks full legal capacity, my trustees ` +
      `shall have the following powers: (a) to pay or apply any part of the income or capital falling to ` +
      `that beneficiary for his or her benefit in any manner my trustees think proper; (b) to retain the ` +
      `same until such capacity is attained, accumulating income with capital; or (c) to pay over the ` +
      `same to the legal guardian or the person for the time being having the custody of that ` +
      `beneficiary, whose receipt shall be a sufficient discharge to my trustees.`
  );

  // TWELVE — Trustee powers
  clause(
    "TWELVE   Powers of My Trustees",
    `My trustees shall have the fullest powers of retention, realisation, investment, transfer of ` +
      `property without consideration, and management of my estate as if they were absolute owners and ` +
      `not trustees. However, all proceeds are for the beneficiaries only. My trustees may appoint one ` +
      `or more executor of their own number to act as solicitor or agent in any other capacity and allow ` +
      `that trustee the same remuneration to which that trustee would have been entitled.`
  );

  // THIRTEEN — Guardianship
  const permGuardians = [...(answers.permanent_guardians || [])].sort((a, b) => a.level - b.level);
  const interimGuardians = [...(answers.interim_guardians || [])].sort((a, b) => a.level - b.level);
  const childBens = beneficiaries.filter((b) => (b.relationship || "").toLowerCase().includes("child"));

  let thirteenBody =
    `Upon my demise, I appoint ${permGuardians[0] ? `my ${val(permGuardians[0].relation, "")} ${val(permGuardians[0].name)}` : `my ${BLANK}`} ` +
    `to act as permanent guardian of my children as follows:\n`;
  if (childBens.length > 0) {
    for (const c of childBens) thirteenBody += `My child ${val(c.name)}.\n`;
  } else {
    thirteenBody += `My child ${BLANK}.\nMy child ${BLANK}.\n`;
  }
  thirteenBody += "\n";
  if (permGuardians[1]) {
    thirteenBody +=
      `In the event of her/him predeceasing me or being unable or unwilling to act, I appoint my ` +
      `${val(permGuardians[1].relation, "")} ${val(permGuardians[1].name)} to act as permanent guardian of my ` +
      `children if they are under the age of full capacity at the time of my death.\n\n`;
  }
  if (interimGuardians[0]) {
    thirteenBody +=
      `However, if the appointed permanent guardians are unable to act, for the interim period only, I ` +
      `appoint ${describePerson(interimGuardians[0])} to act as interim guardian of my children. This ` +
      `interim guardianship appointment will apply until the permanent guardians are able to take over ` +
      `the custody of my children.`;
  }
  clause("THIRTEEN   Guardianship Appointments", thirteenBody);

  // FOURTEEN — Divorce / exclusion
  const exclusion = answers.family_exclusion;
  const disinherited = answers.disinherit || [];
  let fourteenBody =
    `I hereby declare that, in the event of a divorce, my ${BLANK} shall not be entitled to receive or ` +
    `claim any funds or assets from my estate. (OPTIONAL)`;
  if (exclusion?.is_excluding || disinherited.length > 0) {
    const who =
      disinherited.length > 0
        ? disinherited.map((d) => `${val(d.relation, "")} ${val(d.name)}`.trim()).join(", ")
        : BLANK;
    fourteenBody +=
      `\n\nDeclaration clause: I hereby declare that I have made no provision for my ${who} in my Will ` +
      `and he/she shall not be entitled to receive or claim any funds or assets from my estate.`;
    if (exclusion?.details) fourteenBody += `\n\n${exclusion.details}`;
  }
  clause("FOURTEEN   Exclusions", fourteenBody);

  // FINALLY
  clause(
    "FINALLY",
    `I declare that my country of citizenship is ${BLANK} and I am residing in the United Arab ` +
      `Emirates (UAE) at the time of writing this Will.`
  );

  // Execution & attestation
  ensureSpace(40);
  y += 4;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(12, 85, 54);
  doc.text("EXECUTION AND ATTESTATION", M, y);
  y += 7;
  paragraph("This document is executed as follows:", { gap: 6 });
  paragraph(`NAME: ${val(testator.full_name || clientName)}`, { gap: 10 });

  if (signature) {
    // Draw the captured signature in place of the ruled line. Wrapped so a
    // malformed data URL can never abort generation of the whole will —
    // worst case we fall back to the blank line below.
    let drawn = false;
    try {
      ensureSpace(30);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(18, 18, 18);
      doc.text("SIGNATURE:", M, y);
      doc.addImage(signature, "PNG", M + 28, y - 10, 55, 18);
      y += 14;
      doc.setDrawColor(190, 190, 190);
      doc.line(M + 28, y, M + 100, y);
      y += 6;
      if (signatureDate) {
        doc.setFontSize(9.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
          `Signed electronically on ${new Date(signatureDate).toLocaleString("en-GB")}`,
          M + 28,
          y
        );
        y += 8;
      }
      drawn = true;
    } catch (err) {
      console.error("Failed to embed signature in will PDF:", err);
    }
    if (!drawn) {
      paragraph("SIGNATURE: ______________________________", { gap: 8 });
    }
  } else {
    paragraph("SIGNATURE: ______________________________", { gap: 8 });
  }

  if (isAUD) {
    ensureSpace(30);
    y += 6;
    doc.setDrawColor(190, 190, 190);
    doc.line(M, y, RIGHT, y);
    y += 8;
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(90, 90, 90);
    doc.text("To be completed by the Court:", M, y);
    y += 8;
    doc.setFont("times", "normal");
    doc.text("Name of the attestation Officer: ____________________", M, y);
    doc.text("Will Registration Number: ____________", pageWidth / 2 + 5, y);
    y += 8;
    doc.text("Signature: ____________________", M, y);
    doc.text("Date: ____________", pageWidth / 2 + 5, y);
  }

  // Footer line on every page + optional DRAFT watermark
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `This is the Last Will and Testament of ${val(clientName).toUpperCase()}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });

    if (draft) {
      // Faint diagonal JUST WILLS brand watermark across every page.
      doc.setFont("times", "bold");
      doc.setFontSize(46);
      doc.setTextColor(198, 160, 59);
      doc.saveGraphicsState();
      // @ts-expect-error setGState exists at runtime via jsPDF
      doc.setGState(new doc.GState({ opacity: 0.07 }));
      doc.text(
        companyDetails.name.toUpperCase(),
        pageWidth / 2,
        pageHeight / 2,
        { align: "center", angle: 45 }
      );
      doc.restoreGraphicsState();
    }
  }

  return doc.output("datauristring").split(",")[1]; // base64 (no data: prefix)
}
