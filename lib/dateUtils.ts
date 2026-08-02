export function computeAgeText(dobIso: string | null, lang: "sq" | "en"): string {
  if (!dobIso) return "";
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  let tmp = new Date(dob);
  tmp.setMonth(tmp.getMonth() + months);
  if (tmp > now) {
    months -= 1;
    tmp = new Date(dob);
    tmp.setMonth(tmp.getMonth() + months);
  }
  const days = Math.max(0, Math.round((now.getTime() - tmp.getTime()) / 86400000));
  const unitMonths = lang === "en" ? "months" : "muaj";
  const unitDays = lang === "en" ? "days" : "ditë";
  return `${Math.max(0, months)} ${unitMonths}, ${days} ${unitDays}`;
}

export function formatDate(iso: string | null, lang: "sq" | "en"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string, lang: "sq" | "en"): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(lang === "en" ? "en-GB" : "sq-AL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  let s = parts[0]?.charAt(0) ?? "";
  if (parts[1]) s += parts[1].charAt(0);
  return s.toUpperCase() || "?";
}
