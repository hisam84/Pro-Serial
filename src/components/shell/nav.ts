import type { SessionUser } from "@/lib/auth";
import type { UserRole } from "@/db/schema";

export function homePathFor(user: SessionUser): string {
  if (user.role === "super_admin") return "/super-admin";
  if (user.role === "clinic_admin") return "/clinic";
  return "/serials";
}

export function roleLabel(role: UserRole | string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "clinic_admin":
      return "Clinic Admin";
    case "attendant":
      return "Attendant";
    case "doctor":
      return "Doctor";
    default:
      return "";
  }
}
