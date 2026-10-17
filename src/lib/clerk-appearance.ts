// Sober dark chrome for Clerk widgets (DA sobre tokens). Our own copy stays outside them.

export const clerkAppearance = {
  variables: {
    colorPrimary: "#c9a75b",
    colorBackground: "#17171a",
    colorText: "#ededf0",
    colorTextSecondary: "#a0a0ab",
    colorInputBackground: "#0f0f11",
    colorInputText: "#ededf0",
    colorNeutral: "#a0a0ab",
    borderRadius: "10px",
    fontFamily: '"Geist Variable", system-ui, sans-serif',
    fontFamilyButtons: '"Geist Variable", system-ui, sans-serif',
  },
  elements: {
    card: {
      backgroundColor: "#17171a",
      border: "1px solid #26262b",
      boxShadow: "none",
      borderRadius: "12px",
    },
    headerTitle: { fontFamily: '"Geist Variable", system-ui, sans-serif', fontWeight: 600 },
    socialButtonsBlockButton: { borderRadius: "10px" },
    formButtonPrimary: { borderRadius: "10px", color: "#17130a" },
    footerActionLink: { color: "#8ab4ff" },
  },
};
