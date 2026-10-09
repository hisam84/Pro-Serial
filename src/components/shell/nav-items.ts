/**
 * Role → navigation items. Lives in the client bundle so icon components
 * never cross the RSC boundary as props.
 */
import {
  BuildingIcon,
  ChartIcon,
  HomeIcon,
  ListIcon,
  SettingsIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Shown in the mobile bottom navigation (max 4). */
  bottom?: boolean;
}

export function navItemsForRole(role: string): NavItem[] {
  if (role === "super_admin") {
    return [
      { href: "/super-admin", label: "Dashboard", icon: HomeIcon, bottom: true },
      { href: "/super-admin/clinics", label: "Clinics", icon: BuildingIcon, bottom: true },
      { href: "/settings", label: "Settings", icon: SettingsIcon, bottom: true },
    ];
  }

  if (role === "clinic_admin") {
    return [
      { href: "/clinic", label: "Dashboard", icon: HomeIcon },
      { href: "/serials", label: "Serials", icon: ListIcon, bottom: true },
      { href: "/reports", label: "Reports", icon: ChartIcon, bottom: true },
      { href: "/clinic/doctors", label: "Doctors", icon: StethoscopeIcon, bottom: true },
      { href: "/clinic/users", label: "Staff", icon: UserIcon },
      { href: "/clinic/settings", label: "Clinic Settings", icon: BuildingIcon },
      { href: "/settings", label: "Settings", icon: SettingsIcon, bottom: true },
    ];
  }

  return [
    { href: "/serials", label: "Serials", icon: ListIcon, bottom: true },
    { href: "/reports", label: "Reports", icon: ChartIcon, bottom: true },
    { href: "/settings", label: "Settings", icon: SettingsIcon, bottom: true },
  ];
}
