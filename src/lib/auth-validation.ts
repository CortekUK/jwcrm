import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("emailInvalid").nonempty("emailRequired"),
  password: z.string().min(6, "passwordRequired"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "nameTooShort").nonempty("nameRequired"),
  email: z.string().trim().email("emailInvalid").nonempty("emailRequired"),
  password: z.string().min(8, "passwordTooShort").nonempty("passwordRequired"),
  confirmPassword: z.string().min(8, "passwordTooShort").nonempty("passwordRequired"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "passwordsDoNotMatch",
  path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("emailInvalid").nonempty("emailRequired"),
});

export const updatePasswordSchema = z.object({
  newPassword: z.string().min(8, "passwordTooShort").nonempty("passwordRequired"),
  confirmPassword: z.string().min(8, "passwordTooShort").nonempty("passwordRequired"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "passwordsDoNotMatch",
  path: ["confirmPassword"],
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
