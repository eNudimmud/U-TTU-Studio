// Dark ceremonial chrome for Clerk widgets. Our own copy stays outside them.

export const clerkAppearance = {
  variables: {
    colorPrimary: "#c4a574",
    colorBackground: "#111112",
    colorText: "#f1ede6",
    colorTextSecondary: "#a8a6a2",
    colorInputBackground: "#101010",
    colorInputText: "#f1ede6",
    colorNeutral: "#8b909a",
    borderRadius: "0px",
    fontFamily: '"Manrope Variable", "Manrope Fallback", Arial, sans-serif',
    fontFamilyButtons: '"Manrope Variable", "Manrope Fallback", Arial, sans-serif',
  },
  elements: {
    card: {
      backgroundColor: "#141414",
      border: "1px solid rgba(255, 255, 255, 0.11)",
      boxShadow: "none",
      borderRadius: "0px",
    },
    headerTitle: { fontFamily: '"Syne Variable", "Syne Fallback", Arial, sans-serif' },
    socialButtonsBlockButton: { borderRadius: "0px" },
    formButtonPrimary: { borderRadius: "0px", color: "#11100f" },
    footerActionLink: { color: "#c4a574" },
  },
};
