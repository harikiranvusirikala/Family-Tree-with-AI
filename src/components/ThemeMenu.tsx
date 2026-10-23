"use client";

import { setThemeChoice, useThemeChoice, type ThemeChoice } from "./theme";
import { iconButton } from "./ui/button";
import { LineIcon, type IconName } from "./ui/icons";
import { Menu, MenuLabel, menuItem } from "./ui/Menu";

const CHOICES: { choice: ThemeChoice; label: string; icon: IconName }[] = [
  { choice: "light", label: "Day", icon: "sun" },
  { choice: "dark", label: "Night", icon: "moon" },
  { choice: "system", label: "Follow device", icon: "monitor" },
];

/**
 * The header's theme switch on signed-in pages, from tablets up (the production look, an owner
 * request, option B): one button showing the current choice, opening Day, Night and Follow device.
 * Phones keep ThemeToggle in the account menu; the landing page keeps ThemeToggle too.
 */
export function ThemeMenu() {
  const current = useThemeChoice();
  const shown = CHOICES.find((c) => c.choice === current) ?? CHOICES[2];
  return (
    <Menu
      label="Theme"
      buttonLabel="Theme"
      buttonTitle={current ? `Theme: ${shown.label}` : "Theme"}
      button={<LineIcon name={shown.icon} className="size-[18px]" />}
      buttonClassName={iconButton}
      disabled={!current}
      menuClassName="w-52"
    >
      {(close) => (
        <>
          <MenuLabel>Theme</MenuLabel>
          {CHOICES.map(({ choice, label, icon }) => (
            <button
              key={choice}
              type="button"
              role="menuitemradio"
              aria-checked={current === choice}
              onClick={() => {
                setThemeChoice(choice);
                close();
              }}
              className={menuItem}
            >
              <LineIcon name={icon} className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {current === choice && <LineIcon name="check" className="size-4 shrink-0" />}
            </button>
          ))}
        </>
      )}
    </Menu>
  );
}
