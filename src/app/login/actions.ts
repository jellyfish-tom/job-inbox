"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, passwordOk, signSession } from "@/lib/auth";

export async function login(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const password = formData.get("password");
  if (typeof password !== "string" || !passwordOk(password)) {
    return { error: "Invalid password" };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, signSession(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
