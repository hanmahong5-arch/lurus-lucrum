/**
 * Accessibility Utilities
 *
 * Centralized exports for WCAG 2.1 AA accessibility utilities.
 * These modules support:
 * - NFR-4.1: WCAG 2.1 Level AA compliance
 * - NFR-4.2: Keyboard navigation
 * - NFR-4.3: Screen reader support
 * - NFR-4.4: Color contrast (dark mode)
 */

export {
  type RGBColor,
  type ContrastResult,
  getRelativeLuminance,
  getContrastRatio,
  checkContrast,
  hexToRgb,
  checkHexContrast,
  suggestMinOpacityForAA,
} from './color-contrast';

export {
  type FocusTrap,
  type FocusTrapOptions,
  createFocusTrap,
  getFocusableElements,
  focusFirstElement,
  focusLastElement,
} from './focus-trap';

export {
  type AriaLivePoliteness,
  type LiveAnnouncer,
  createLiveAnnouncer,
  getGlobalAnnouncer,
  announce,
} from './live-region';

export {
  MAIN_CONTENT_ID,
  SKIP_LINK_TEXT_ZH,
  SKIP_LINK_TEXT_EN,
  SKIP_LINK_CLASSES,
  skipToMainContent,
} from './skip-link';

export {
  KEYS,
  type KeyName,
  type RovingTabindexOptions,
  type RovingTabindexController,
  createRovingTabindex,
  isNativelyInteractive,
  onActivationKey,
} from './keyboard-navigation';
