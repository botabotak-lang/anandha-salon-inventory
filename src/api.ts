export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
    return data as T;
  }
  if (!res.ok) throw new Error(res.statusText);
  return undefined as T;
}

export function downloadCsv(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}
