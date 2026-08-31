"use client";

import { Button, TextInput } from "@proteus-ui/core";
import { useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <main className="login-page">
      <form className="login-form" action={handleSubmit}>
        <TextInput
          id="password"
          name="password"
          type="password"
          required
          aria-label="Password"
          placeholder="Enter your password"
        />
        <Button type="submit" intent="primary">
          Log in
        </Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </main>
  );
}
