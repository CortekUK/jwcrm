"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import justWillsLogo from "@/assets/justwills.png";

const logoSrc = (justWillsLogo as unknown as { src: string }).src;

export default function IntakePage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
    lead_type: "individual",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0C5536] rounded-t-xl px-6 py-6 text-center">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2">
            <img src={logoSrc} alt="Just Wills" className="h-9 w-auto" />
          </div>
          <h1 className="text-[#C6A03B] text-2xl font-bold">JW Legal Consultants</h1>
          <p className="text-[#E6E6E4] text-sm mt-1">Enquiry Form</p>
        </div>

        <div className="bg-white rounded-b-xl border border-t-0 border-[#E6E6E4] p-6 shadow-sm">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-[#0C5536] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#121212]">Thank you!</h2>
              <p className="text-sm text-[#555555] mt-2">
                We&apos;ve received your details and a member of our team will be in touch shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-[#555555] mb-2">
                Please share your details and our team will contact you about your Will.
              </p>

              <div className="space-y-1.5">
                <Label className="text-[#555555]">Full Name *</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#555555]">Email *</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[#555555]">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#555555]">Type</Label>
                  <Select value={form.lead_type} onValueChange={(v) => set("lead_type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#555555]">Company (optional)</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => set("company_name", e.target.value)}
                  placeholder="Company name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#555555]">Message (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="How can we help?"
                  rows={3}
                />
              </div>

              {error && <p className="text-sm text-[#C0392B]">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white h-11"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#999999] mt-4">
          © {new Date().getFullYear()} JW Legal Consultants LLC
        </p>
      </div>
    </div>
  );
}
