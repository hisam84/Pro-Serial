export {
  ArrowRightIcon,
  BuildingIcon,
  MessageIcon,
  PlusIcon,
  SettingsIcon,
  StethoscopeIcon,
  UserIcon,
} from "./icons";

/** Padlock icon (settings page). */
export const LockIcon = ({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
