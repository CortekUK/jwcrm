import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, Mail, User, AlertCircle, Shield, Users, Target, UserCheck, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

interface CreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: () => void;
}

interface ClientCredentials {
  userId: string;
  email: string;
  fullName: string;
  tempPassword: string;
  emailSent: boolean;
  emailError: string | null;
}

export function CreateClientModal({ open, onOpenChange, onUserCreated }: CreateClientModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation(['admin', 'toast']);
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [userRoles, setUserRoles] = useState<string[]>(["client"]);
  const [sendEmail, setSendEmail] = useState(true);

  // Check if current user is superadmin
  const isSuperadmin = profile?.roles?.includes("superadmin");

  // Base roles available to all admins
  const baseRoles = [
    { value: "client", label: "admin:client", icon: User, bgColor: "bg-[rgba(12,85,54,0.08)]", textColor: "text-[#0C5536]", borderColor: "border-[#0C5536]/20" },
    { value: "admin", label: "admin:administrator", icon: Shield, bgColor: "bg-[rgba(139,92,246,0.1)]", textColor: "text-[#7C3AED]", borderColor: "border-[#7C3AED]/20" },
    { value: "hr", label: "admin:hr", icon: Users, bgColor: "bg-[rgba(20,184,166,0.1)]", textColor: "text-[#0D9488]", borderColor: "border-[#0D9488]/20" },
    { value: "finance", label: "admin:finance", icon: Banknote, bgColor: "bg-[rgba(234,179,8,0.1)]", textColor: "text-[#CA8A04]", borderColor: "border-[#CA8A04]/20" },
    { value: "lead_management", label: "admin:leadManagement", icon: Target, bgColor: "bg-[rgba(245,158,11,0.1)]", textColor: "text-[#D97706]", borderColor: "border-[#D97706]/20" },
  ];

  // Salesperson role only available when created by superadmin
  const availableRoles = isSuperadmin
    ? [...baseRoles, { value: "salesperson", label: "admin:salesperson", icon: UserCheck, bgColor: "bg-[rgba(59,130,246,0.1)]", textColor: "text-[#2563EB]", borderColor: "border-[#2563EB]/20" }]
    : baseRoles;

  const [credentials, setCredentials] = useState<ClientCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      toast({
        title: t('toast:validationError'),
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-dashboard-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fullName,
            email,
            locale,
            roles: userRoles,
            sendWelcomeEmail: sendEmail,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create client');
      }

      const result = await response.json();

      // Store credentials to display
      setCredentials(result.data);

      // Refresh admin wills list
      queryClient.invalidateQueries({ queryKey: ["admin-wills"] });

      toast({
        title: t('toast:admin.userCreatedSuccess', { role: userRoles.includes('admin') ? 'Admin' : 'User' }),
        description: t('toast:admin.accountCreatedFor', { name: fullName }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: t('toast:admin.errorCreatingClient'),
        description: error.message || t('toast:admin.couldNotCreateAccount'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;

    const message = `Welcome to Just Wills!

Your account has been created:

Email: ${credentials.email}
Temporary Password: ${credentials.tempPassword}

Login at: ${window.location.origin}/login

Please change your password after your first login for security.

Best regards,
Just Wills Team`;

    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: t('toast:admin.copiedToClipboard'),
      description: t('toast:admin.credentialsCopied'),
    });
  };

  const handleClose = () => {
    // Call the callback if user was created and we're closing with credentials shown
    if (credentials && onUserCreated) {
      onUserCreated();
    }

    setFullName("");
    setEmail("");
    setLocale("en");
    setUserRoles(["client"]);
    setSendEmail(true);
    setCredentials(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-[hsl(var(--jw-primary-green))] flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-full bg-[rgba(12,85,54,0.08)] flex items-center justify-center">
              <User className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
            </div>
            {credentials
              ? t('admin:createClientModal.userCreated')
              : t('admin:createClientModal.createNewUser')}
          </DialogTitle>
          <DialogDescription className="text-[#777777] text-sm">
            {credentials
              ? t('admin:createClientModal.userAccountCreated')
              : t('admin:createClientModal.createUserDescription')}
          </DialogDescription>
        </DialogHeader>

        {!credentials ? (
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-[#555555] text-sm font-medium">
                {t('admin:createClientModal.fullName')} <span className="text-[#DC2626] text-xs">*</span>
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('admin:createClientModal.enterFullName', { role: t('admin:user') })}
                className="border-[#E6E6E4] focus:border-[hsl(var(--jw-primary-green))] focus:ring-1 focus:ring-[hsl(var(--jw-primary-green))] h-10"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#555555] text-sm font-medium">
                {t('admin:createClientModal.emailAddress')} <span className="text-[#DC2626] text-xs">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('admin:createClientModal.emailPlaceholder', { role: 'user' })}
                className="border-[#E6E6E4] focus:border-[hsl(var(--jw-primary-green))] focus:ring-1 focus:ring-[hsl(var(--jw-primary-green))] h-10"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#555555] text-sm font-medium">
                {t('admin:createClientModal.userRoles')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {availableRoles.map((role) => {
                  const Icon = role.icon;
                  const isChecked = userRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => {
                        if (loading) return;
                        if (isChecked) {
                          if (userRoles.length > 1) {
                            setUserRoles(prev => prev.filter(r => r !== role.value));
                          }
                        } else {
                          setUserRoles(prev => [...prev, role.value]);
                        }
                      }}
                      disabled={loading}
                      className={`flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-all text-left ${
                        isChecked 
                          ? `${role.bgColor} border-2 ${role.borderColor} shadow-sm` 
                          : 'bg-[#FAFAF8] border border-[#E6E6E4] hover:border-[#CCCCC9]'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isChecked ? role.bgColor : 'bg-white'
                      }`}>
                        <Icon className={`h-4 w-4 ${isChecked ? role.textColor : 'text-[#777777]'}`} />
                      </div>
                      <span className={`text-sm font-medium ${isChecked ? role.textColor : 'text-[#555555]'}`}>
                        {t(role.label)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#999999]">
                {t('admin:createClientModal.selectMultipleRoles')}
              </p>
            </div>



            <div className="flex justify-end gap-3 pt-5 border-t border-[#E6E6E4] mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-[#E6E6E4] text-[#555555] hover:bg-[#F5F5F3] hover:text-[#333333]"
              >
                {t('admin:createClientModal.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white min-w-[120px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin:createClientModal.creating')}
                  </>
                ) : (
                  t('admin:createClientModal.createUser')
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Success Message */}
            <div className="p-4 bg-[#E6F7F1] rounded-lg border-2 border-[hsl(var(--jw-primary-green))]">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[hsl(var(--jw-primary-green))] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-[hsl(var(--jw-primary-green))] mb-1">
                    Account Created Successfully
                  </p>
                  <p className="text-sm text-[#555555]">
                    A new account has been created for <strong>{credentials.fullName}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Email Status */}
            {credentials.emailSent ? (
              <div className="p-3 bg-[#E6F7F1] rounded-lg flex items-start gap-2">
                <Mail className="h-4 w-4 text-[hsl(var(--jw-primary-green))] mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                    Welcome email sent successfully
                  </p>
                  <p className="text-xs text-[#6B6B6B] mt-1">
                    The client will receive their login credentials via email
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#FFF9E6] rounded-lg flex items-start gap-2 border border-[#C6A03B]/20">
                <AlertCircle className="h-4 w-4 text-[#C6A03B] mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#C6A03B]">
                    Email not sent
                  </p>
                  <p className="text-xs text-[#6B6B6B] mt-1">
                    {credentials.emailError || "Please copy and send the credentials manually to the client"}
                  </p>
                </div>
              </div>
            )}

            {/* Credentials Display */}
            <div className="p-4 bg-white rounded-lg border-2 border-[#E6E6E4]">
              <h4 className="font-semibold text-[#222222] mb-3">Login Credentials:</h4>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-[#777777]">Email</Label>
                  <p className="font-medium text-[#222222] text-sm">{credentials.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-[#777777]">Temporary Password</Label>
                  <p className="font-mono text-[#222222] text-sm bg-[#f5f5f5] p-2 rounded">
                    {credentials.tempPassword}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCopyCredentials}
                className="flex-1 border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/10"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Credentials
                  </>
                )}
              </Button>
              <Button
                onClick={handleClose}
                className="flex-1 bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                Done
              </Button>
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-[#f5f5f5] rounded-lg">
              <p className="text-xs text-[#6B6B6B]">
                🔒 <strong>Security reminder:</strong> The client should change their password immediately after first login.
                The temporary password will not be shown again.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
