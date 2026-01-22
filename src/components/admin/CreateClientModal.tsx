import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, Check, Mail, User, Globe, AlertCircle, Shield, Users, DollarSign, Target, UserCheck } from "lucide-react";
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
    { value: "client", label: "admin:client", icon: User, color: "text-[#0C5536]" },
    { value: "admin", label: "admin:administrator", icon: Shield, color: "text-[#DC2626]" },
    { value: "hr", label: "admin:hr", icon: Users, color: "text-[#16A34A]" },
    { value: "finance", label: "admin:finance", icon: DollarSign, color: "text-[#CA8A04]" },
    { value: "lead_management", label: "admin:leadManagement", icon: Target, color: "text-[#E11D48]" },
  ];

  // Salesperson role only available when created by superadmin
  const availableRoles = isSuperadmin
    ? [...baseRoles, { value: "salesperson", label: "admin:salesperson", icon: UserCheck, color: "text-[#7C3AED]" }]
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
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--jw-primary-green))] flex items-center gap-2">
            <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {credentials
              ? t('admin:createClientModal.userCreated')
              : t('admin:createClientModal.createNewUser')}
          </DialogTitle>
          <DialogDescription>
            {credentials
              ? t('admin:createClientModal.userAccountCreated')
              : t('admin:createClientModal.createUserDescription')}
          </DialogDescription>
        </DialogHeader>

        {!credentials ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#555555]">
                {t('admin:createClientModal.fullName')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('admin:createClientModal.enterFullName', { role: t('admin:user') })}
                className="border-[#E6E6E4]"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#555555]">
                {t('admin:createClientModal.emailAddress')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('admin:createClientModal.emailPlaceholder', { role: 'user' })}
                className="border-[#E6E6E4]"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#555555] flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('admin:createClientModal.userRoles')}
              </Label>
              <div className="grid grid-cols-2 gap-2 p-3 border border-[#E6E6E4] rounded-md bg-[#FAFAF8]">
                {availableRoles.map((role) => {
                  const Icon = role.icon;
                  const isChecked = userRoles.includes(role.value);
                  return (
                    <label
                      key={role.value}
                      htmlFor={`role-${role.value}`}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        isChecked ? 'bg-white border border-[#E6E6E4] shadow-sm' : 'hover:bg-white/50'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Checkbox
                        id={`role-${role.value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (loading) return;
                          if (checked) {
                            setUserRoles(prev => [...prev, role.value]);
                          } else {
                            if (userRoles.length > 1) {
                              setUserRoles(prev => prev.filter(r => r !== role.value));
                            }
                          }
                        }}
                        disabled={loading}
                        className="data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
                      />
                      <Icon className={`h-4 w-4 ${role.color}`} />
                      <span className="text-sm flex-1">
                        {t(role.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-[#777777]">
                {t('admin:createClientModal.selectMultipleRoles')}
              </p>
            </div>



            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-[#E6E6E4]"
              >
                {t('admin:createClientModal.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
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
