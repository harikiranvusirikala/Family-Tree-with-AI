// Day, night, or follow the device. A plain module (no "use client"), because the root layout, a
// server component, puts this script in <head>: it runs before the first paint, so a page never
// flashes the wrong theme. A saved "light" or "dark" wins; with nothing saved, the device's setting.
export const THEME_KEY = "theme";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;
