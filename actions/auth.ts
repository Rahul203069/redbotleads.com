"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/auth-input";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
};

export type PasswordResetActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
};

const signupSchema = z
  .object({
    email: z.preprocess(
      (value) => normalizeEmail(typeof value === "string" ? value : ""),
      z.string().email("Enter a valid email address."),
    ),
    password: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
    ),
    confirmPassword: z.preprocess((value) => (typeof value === "string" ? value : ""), z.string()),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const passwordResetSchema = z
  .object({
    currentPassword: z.preprocess((value) => (typeof value === "string" ? value : ""), z.string()),
    newPassword: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
    ),
    confirmPassword: z.preprocess((value) => (typeof value === "string" ? value : ""), z.string()),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function signUpWithPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const { email, password } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        accounts: {
          select: {
            provider: true,
          },
        },
        password: true,
      },
    });

    if (existingUser?.password) {
      return {
        status: "error",
        message: "An account already exists for this email. Sign in instead.",
        fieldErrors: {
          email: "An account already exists for this email.",
        },
      };
    }

    if (existingUser) {
      const hasGoogleAccount = existingUser.accounts.some((account) => account.provider === "google");

      return {
        status: "error",
        message: hasGoogleAccount
          ? "This email already uses Google sign-in. Continue with Google for this account."
          : "An account already exists for this email. Use the existing sign-in method.",
        fieldErrors: {
          email: "Use the existing sign-in method for this email.",
        },
      };
    }

    await prisma.user.create({
      data: {
        email,
        password: {
          create: {
            hash: await hashPassword(password),
          },
        },
      },
    });
  } catch (error) {
    console.error("Password signup failed", error);

    return {
      status: "error",
      message: "Could not create the account. Try again.",
    };
  }

  return {
    status: "success",
    message: "Account created. Signing you in.",
  };
}

export async function resetProfilePassword(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to reset your password.",
    };
  }

  const parsed = passwordResetSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        currentPassword: fieldErrors.currentPassword?.[0],
        newPassword: fieldErrors.newPassword?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        password: true,
      },
    });

    if (!user) {
      return {
        status: "error",
        message: "Your account could not be found. Sign in again.",
      };
    }

    if (user.password) {
      if (!currentPassword) {
        return {
          status: "error",
          message: "Enter your current password.",
          fieldErrors: {
            currentPassword: "Current password is required.",
          },
        };
      }

      const currentPasswordIsValid = await verifyPassword(currentPassword, user.password.hash);

      if (!currentPasswordIsValid) {
        return {
          status: "error",
          message: "Current password is incorrect.",
          fieldErrors: {
            currentPassword: "Current password is incorrect.",
          },
        };
      }
    }

    const newHash = await hashPassword(newPassword);

    await prisma.userPassword.upsert({
      where: {
        userId: user.id,
      },
      create: {
        userId: user.id,
        hash: newHash,
      },
      update: {
        hash: newHash,
      },
    });
  } catch (error) {
    console.error("Profile password reset failed", error);

    return {
      status: "error",
      message: "Could not reset your password. Try again.",
    };
  }

  revalidatePath("/settings/profile");

  return {
    status: "success",
    message: "Password updated.",
  };
}
