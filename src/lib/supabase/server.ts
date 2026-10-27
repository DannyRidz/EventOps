import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serviceConfig } from "./config";

export async function serverClient() {
  const { url, key } = serviceConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://") ?? false,
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies; proxy refreshes them. */
        }
      },
    },
  });
}
export async function authenticatedClient() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
    throw new Error("UNAUTHENTICATED");
  return client;
}
