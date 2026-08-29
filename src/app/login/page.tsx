"use client";

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
    <main>
      <h1>Login</h1>
      <form action={handleSubmit}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Log in</button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </main>
  );
}
