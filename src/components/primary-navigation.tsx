"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/logs", label: "Daily logs" },
  { href: "/assistant", label: "Assistant" },
  { href: "/reminders", label: "Reminders" },
  { href: "/prescriptions", label: "Prescriptions" },
  { href: "/summary", label: "Summary" },
];

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
              isActive
                ? "bg-[#dfe8d8] text-[#254a38]"
                : "text-[#66766b] hover:bg-[#eef0e5] hover:text-[#254a38]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
