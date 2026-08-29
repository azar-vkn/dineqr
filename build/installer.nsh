; ─── DineQR custom NSIS installer script ───────────────────────
; electron-builder inserts customWelcomePage before the license and
; directory pages, giving the classic wizard flow:
;   Welcome → License → Choose Install Location → Install → Finish

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to DineQR Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of DineQR — Smart Restaurant Ordering.$\r$\n$\r$\nIt is recommended that you close all other applications before continuing. This will make it possible to update relevant files without having to reboot your computer.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_UNWELCOMEPAGE_TITLE "Uninstall DineQR"
  !define MUI_UNWELCOMEPAGE_TEXT "This wizard will guide you through the removal of DineQR — Smart Restaurant Ordering.$\r$\n$\r$\nBefore continuing, make sure DineQR is not running.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
